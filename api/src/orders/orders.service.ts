import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createPublicClient, http, parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import { PaginatedResponse, PaginationMeta } from '../products/dto/paginated-response.dto';
import { Product } from '../products/entities/product.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { OrderItem } from './entities/order-item.entity';
import { Order, OrderStatus } from './entities/order.entity';

@Injectable()
export class OrdersService {
  private readonly viemClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

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

        const unitPrice = Number(product.price);
        total = parseFloat((total + unitPrice * item.quantity).toFixed(18));

        orderItems.push(
          manager.create(OrderItem, {
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unitPrice,
          }),
        );
      }

      const order = manager.create(Order, {
        status: OrderStatus.PENDING,
        customerName: dto.customerName,
        shippingAddress: dto.shippingAddress,
        walletAddress: dto.walletAddress,
        totalAmount: total,
        txHash: null,
        items: orderItems as OrderItem[],
      });

      const saved = await manager.save(order);
      return {
        orderId: saved.id,
        totalAmount: String(total),
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
