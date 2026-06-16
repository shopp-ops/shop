import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import { createPublicClient, http, parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import {
  PaginatedResponse,
  PaginationMeta,
} from '../products/dto/paginated-response.dto';
import { Product } from '../products/entities/product.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { OrderItem } from './entities/order-item.entity';
import { Order, OrderStatus } from './entities/order.entity';

const CHAINLINK_ETH_USD_SEPOLIA =
  '0x694AA1769357215DE4FAC081bf1f309aDC325306' as const;

const chainlinkAggregatorAbi = [
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const PENDING_ORDER_TTL_MINUTES = 15;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  private readonly viemClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  private async getEthUsdRate(): Promise<number> {
    const result = await this.viemClient.readContract({
      address: CHAINLINK_ETH_USD_SEPOLIA,
      abi: chainlinkAggregatorAbi,
      functionName: 'latestRoundData',
    });
    // answer is int256 with 8 decimal places, e.g. 342015000000 = $3420.15
    return Number(result[1]) / 1e8;
  }

  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    private dataSource: DataSource,
    private config: ConfigService,
  ) {}

  async create(dto: CreateOrderDto): Promise<{
    orderId: string;
    totalAmount: string;
    shopWalletAddress: string;
  }> {
    const shopWalletAddress = this.config.getOrThrow<string>('WALLET_ADDRESS');

    return this.dataSource.transaction(async (manager) => {
      let total = 0;
      const orderItems: Partial<OrderItem>[] = [];

      for (const item of dto.items) {
        const product = await manager.findOne(Product, {
          where: { id: item.productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new NotFoundException(`Product #${item.productId} not found`);
        }
        if (product.quantity < item.quantity) {
          throw new ConflictException(
            `Insufficient stock for "${product.name}"`,
          );
        }

        product.quantity -= item.quantity;
        await manager.save(product);

        const unitPriceUsd = Number(product.price);
        total = parseFloat((total + unitPriceUsd * item.quantity).toFixed(10));

        orderItems.push(
          manager.create(OrderItem, {
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unitPrice: unitPriceUsd, // stored in USD
          }),
        );
      }

      const ethUsdRate = await this.getEthUsdRate();
      const totalEth = parseFloat((total / ethUsdRate).toFixed(18));

      const order = manager.create(Order, {
        status: OrderStatus.PENDING,
        customerName: dto.customerName,
        shippingAddress: dto.shippingAddress,
        walletAddress: dto.walletAddress,
        totalAmount: totalEth,
        txHash: null,
        items: orderItems as OrderItem[],
      });

      const saved = await manager.save(order);
      return {
        orderId: saved.id,
        totalAmount: String(totalEth),
        shopWalletAddress,
      };
    });
  }

  async verifyPayment(orderId: string, dto: VerifyPaymentDto): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);
    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException('Order is not in a pending state');
    }

    const shopWalletAddress = this.config.getOrThrow<string>('WALLET_ADDRESS');
    const txHash = dto.txHash as `0x${string}`;

    const [tx, receipt] = await Promise.all([
      this.viemClient.getTransaction({ hash: txHash }),
      this.viemClient.getTransactionReceipt({ hash: txHash }),
    ]);

    const expectedWei = parseEther(String(order.totalAmount));
    const recipientOk =
      tx.to?.toLowerCase() === shopWalletAddress.toLowerCase();
    const valueOk = tx.value >= expectedWei;
    const statusOk = receipt.status === 'success';

    order.txHash = dto.txHash;

    if (!recipientOk || !valueOk || !statusOk) {
      order.status = OrderStatus.FAILED;
      await this.orderRepo.save(order);
      throw new UnprocessableEntityException('Transaction verification failed');
    }

    order.status = OrderStatus.CONFIRMED;
    return this.orderRepo.save(order);
  }

  async cancel(orderId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);
    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException('Only pending orders can be cancelled');
    }
    return this.restoreStockAndSetStatus(order, OrderStatus.CANCELLED);
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireStaleOrders(): Promise<void> {
    const cutoff = new Date(Date.now() - PENDING_ORDER_TTL_MINUTES * 60 * 1000);
    const stale = await this.orderRepo.find({
      where: { status: OrderStatus.PENDING, createdAt: LessThan(cutoff) },
    });
    if (stale.length === 0) return;

    this.logger.log(`Expiring ${stale.length} stale pending order(s)`);
    await Promise.all(
      stale.map((order) =>
        this.restoreStockAndSetStatus(order, OrderStatus.EXPIRED),
      ),
    );
  }

  private async restoreStockAndSetStatus(
    order: Order,
    status: OrderStatus.CANCELLED | OrderStatus.EXPIRED,
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      for (const item of order.items) {
        await manager.increment(
          Product,
          { id: item.productId },
          'quantity',
          item.quantity,
        );
      }
      order.status = status;
      return manager.save(order);
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Order>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, totalItems] = await this.orderRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const meta: PaginationMeta = {
      totalItems,
      itemCount: data.length,
      itemsPerPage: limit,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };

    return { data, meta };
  }
}
