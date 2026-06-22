import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createPublicClient, http, parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import { PaginatedResponse } from '../products/dto/paginated-response.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { OrderStatus } from './entities/order.entity';
import {
  OrderRecord,
  OrdersRepository,
} from './repositories/orders.repository';

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

    return Number(result[1]) / 1e8;
  }

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateOrderDto): Promise<{
    orderId: string;
    totalAmount: string;
    shopWalletAddress: string;
  }> {
    const shopWalletAddress = this.config.getOrThrow<string>('WALLET_ADDRESS');
    const ethUsdRate = await this.getEthUsdRate();
    const result = await this.ordersRepository.create(dto, ethUsdRate);

    return {
      ...result,
      shopWalletAddress,
    };
  }

  async verifyPayment(
    orderId: string,
    dto: VerifyPaymentDto,
  ): Promise<OrderRecord> {
    const order = await this.ordersRepository.findOne(orderId);
    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }
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
      await this.ordersRepository.save(order);
      throw new UnprocessableEntityException('Transaction verification failed');
    }

    order.status = OrderStatus.CONFIRMED;
    return this.ordersRepository.save(order);
  }

  async cancel(orderId: string): Promise<OrderRecord> {
    const order = await this.ordersRepository.findOne(orderId);
    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException('Only pending orders can be cancelled');
    }

    const updated = await this.ordersRepository.restoreStockAndSetStatus(
      orderId,
      OrderStatus.CANCELLED,
    );

    if (!updated) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    return updated;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireStaleOrders(): Promise<void> {
    const cutoff = new Date(Date.now() - PENDING_ORDER_TTL_MINUTES * 60 * 1000);
    const staleOrders = await this.ordersRepository.findStalePending(cutoff);
    if (staleOrders.length === 0) {
      return;
    }

    this.logger.log(`Expiring ${staleOrders.length} stale pending order(s)`);
    await Promise.all(
      staleOrders.map((order) =>
        this.ordersRepository.restoreStockAndSetStatus(
          order.id,
          OrderStatus.EXPIRED,
        ),
      ),
    );
  }

  findAll(query: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<OrderRecord>> {
    return this.ordersRepository.findAll(query);
  }
}
