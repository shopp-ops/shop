import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import {
  PaginatedResponse,
  PaginationMeta,
} from '../../products/dto/paginated-response.dto';
import { Product } from '../../products/entities/product.entity';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderItem } from '../entities/order-item.entity';
import { Order, OrderStatus } from '../entities/order.entity';
import {
  CreateOrderResult,
  OrderItemRecord,
  OrderRecord,
  OrdersRepository,
} from './orders.repository';

@Injectable()
export class PostgresOrdersRepository extends OrdersRepository {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  async create(
    dto: CreateOrderDto,
    ethUsdRate: number,
  ): Promise<CreateOrderResult> {
    return this.dataSource.transaction(async (manager) => {
      let totalUsd = 0;
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
        totalUsd = parseFloat(
          (totalUsd + unitPriceUsd * item.quantity).toFixed(10),
        );

        orderItems.push(
          manager.create(OrderItem, {
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unitPrice: unitPriceUsd,
          }),
        );
      }

      const totalEth = parseFloat((totalUsd / ethUsdRate).toFixed(18));
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
      };
    });
  }

  async findOne(id: string): Promise<OrderRecord | null> {
    const order = await this.orderRepo.findOne({ where: { id } });
    return order ? this.toOrderRecord(order) : null;
  }

  async save(order: OrderRecord): Promise<OrderRecord> {
    const persisted = await this.orderRepo.save(this.toOrderEntity(order));
    return this.toOrderRecord(persisted);
  }

  async restoreStockAndSetStatus(
    orderId: string,
    status: OrderStatus.CANCELLED | OrderStatus.EXPIRED,
  ): Promise<OrderRecord | null> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id: orderId } });
      if (!order) {
        return null;
      }

      for (const item of order.items) {
        await manager.increment(
          Product,
          { id: item.productId },
          'quantity',
          item.quantity,
        );
      }

      order.status = status;
      const saved = await manager.save(order);
      return this.toOrderRecord(saved);
    });
  }

  async findStalePending(cutoff: Date): Promise<OrderRecord[]> {
    const staleOrders = await this.orderRepo.find({
      where: { status: OrderStatus.PENDING, createdAt: LessThan(cutoff) },
    });

    return staleOrders.map((order) => this.toOrderRecord(order));
  }

  async findAll(query: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<OrderRecord>> {
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

    return {
      data: data.map((order) => this.toOrderRecord(order)),
      meta,
    };
  }

  async insert(record: OrderRecord): Promise<void> {
    await this.orderRepo.save(this.toOrderEntity(record));
  }

  async clear(): Promise<void> {
    await this.orderRepo.delete({});
  }

  private toOrderRecord(order: Order): OrderRecord {
    return {
      id: order.id,
      status: order.status,
      customerName: order.customerName,
      shippingAddress: order.shippingAddress,
      walletAddress: order.walletAddress,
      totalAmount: order.totalAmount,
      txHash: order.txHash,
      items: order.items.map((item) => this.toOrderItemRecord(item)),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private toOrderEntity(order: OrderRecord): Order {
    return Object.assign(new Order(), {
      id: order.id,
      status: order.status,
      customerName: order.customerName,
      shippingAddress: order.shippingAddress,
      walletAddress: order.walletAddress,
      totalAmount: order.totalAmount,
      txHash: order.txHash,
      items: order.items.map((item) =>
        Object.assign(new OrderItem(), {
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }),
      ),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  }

  private toOrderItemRecord(item: OrderItem): OrderItemRecord {
    return {
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    };
  }
}
