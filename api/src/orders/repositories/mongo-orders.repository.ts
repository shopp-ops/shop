import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Connection, Model, createConnection } from 'mongoose';
import {
  PaginatedResponse,
  PaginationMeta,
} from '../../products/dto/paginated-response.dto';
import {
  MongoProduct,
  mongoProductSchema,
} from '../../products/entities/mongo-product.schema';
import { CreateOrderDto, OrderItemInputDto } from '../dto/create-order.dto';
import {
  MongoOrder,
  MongoOrderItem,
  mongoOrderSchema,
} from '../entities/mongo-order.schema';
import { OrderStatus } from '../entities/order.entity';
import {
  CreateOrderResult,
  OrderRecord,
  OrdersRepository,
} from './orders.repository';

@Injectable()
export class MongoOrdersRepository
  extends OrdersRepository
  implements OnModuleDestroy
{
  private connection?: Connection;
  private connectionPromise?: Promise<Connection>;
  private orderModelPromise?: Promise<Model<MongoOrder>>;
  private productModelPromise?: Promise<Model<MongoProduct>>;

  constructor(private readonly config: ConfigService) {
    super();
  }

  async create(
    dto: CreateOrderDto,
    ethUsdRate: number,
  ): Promise<CreateOrderResult> {
    const reservedItems = await this.reserveStock(dto.items);

    try {
      const totalUsd = reservedItems.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );
      const totalEth = parseFloat((totalUsd / ethUsdRate).toFixed(18));
      const OrderModel = await this.getOrderModel();

      const created = await OrderModel.create({
        _id: randomUUID(),
        status: OrderStatus.PENDING,
        customerName: dto.customerName,
        shippingAddress: dto.shippingAddress,
        walletAddress: dto.walletAddress,
        totalAmount: totalEth,
        txHash: null,
        items: reservedItems.map((item) => ({
          _id: randomUUID(),
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });

      return {
        orderId: created._id,
        totalAmount: String(totalEth),
      };
    } catch (error) {
      await this.restoreProductsStock(
        reservedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      );
      throw error;
    }
  }

  async findOne(id: string): Promise<OrderRecord | null> {
    const OrderModel = await this.getOrderModel();
    const order = await OrderModel.findById(id).lean().exec();

    return order ? this.toOrderRecord(order) : null;
  }

  async save(order: OrderRecord): Promise<OrderRecord> {
    const OrderModel = await this.getOrderModel();
    const updated = await OrderModel.findByIdAndUpdate(
      order.id,
      {
        status: order.status,
        customerName: order.customerName,
        shippingAddress: order.shippingAddress,
        walletAddress: order.walletAddress,
        totalAmount: Number(order.totalAmount),
        txHash: order.txHash,
        items: order.items.map((item) => ({
          _id: item.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        })),
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException(`Order #${order.id} not found`);
    }

    return this.toOrderRecord(updated);
  }

  async restoreStockAndSetStatus(
    orderId: string,
    status: OrderStatus.CANCELLED | OrderStatus.EXPIRED,
  ): Promise<OrderRecord | null> {
    const order = await this.findOne(orderId);
    if (!order) {
      return null;
    }

    const OrderModel = await this.getOrderModel();
    const updated = await OrderModel.findOneAndUpdate(
      {
        _id: orderId,
        status: OrderStatus.PENDING,
      },
      {
        $set: { status },
      },
      {
        returnDocument: 'after',
      },
    )
      .lean()
      .exec();

    if (!updated) {
      return this.findOne(orderId);
    }

    await this.restoreProductsStock(
      updated.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    );

    return this.toOrderRecord(updated);
  }

  async findStalePending(cutoff: Date): Promise<OrderRecord[]> {
    const OrderModel = await this.getOrderModel();
    const staleOrders = await OrderModel.find({
      status: OrderStatus.PENDING,
      createdAt: { $lt: cutoff },
    })
      .lean()
      .exec();

    return staleOrders.map((order) => this.toOrderRecord(order));
  }

  async findAll(query: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<OrderRecord>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const OrderModel = await this.getOrderModel();

    const [data, totalItems] = await Promise.all([
      OrderModel.find({})
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      OrderModel.countDocuments({}).exec(),
    ]);

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

  async onModuleDestroy(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
    }
  }

  private async reserveStock(items: OrderItemInputDto[]) {
    const ProductModel = await this.getProductModel();
    const reserved: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
    }> = [];

    for (const item of items) {
      const updatedProduct = await ProductModel.findOneAndUpdate(
        {
          _id: item.productId,
          quantity: { $gte: item.quantity },
        },
        {
          $inc: { quantity: -item.quantity },
        },
        {
          returnDocument: 'before',
        },
      )
        .lean()
        .exec();

      if (!updatedProduct) {
        await this.restoreProductsStock(
          reserved.map((reservedItem) => ({
            productId: reservedItem.productId,
            quantity: reservedItem.quantity,
          })),
        );

        const existingProduct = await ProductModel.findById(item.productId)
          .lean()
          .exec();
        if (!existingProduct) {
          throw new NotFoundException(`Product #${item.productId} not found`);
        }

        throw new ConflictException(
          `Insufficient stock for "${existingProduct.name}"`,
        );
      }

      reserved.push({
        productId: updatedProduct._id,
        productName: updatedProduct.name,
        quantity: item.quantity,
        unitPrice: Number(updatedProduct.price),
      });
    }

    return reserved;
  }

  private async restoreProductsStock(
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const ProductModel = await this.getProductModel();

    for (const item of items) {
      await ProductModel.findByIdAndUpdate(item.productId, {
        $inc: { quantity: item.quantity },
      }).exec();
    }
  }

  private async getConnection(): Promise<Connection> {
    if (this.connection) {
      return this.connection;
    }

    if (!this.connectionPromise) {
      const uri = this.config.getOrThrow<string>('DATABASE_URL');
      this.connectionPromise = createConnection(uri)
        .asPromise()
        .then((connection) => {
          this.connection = connection;
          return connection;
        });
    }

    return this.connectionPromise;
  }

  private async getOrderModel(): Promise<Model<MongoOrder>> {
    if (!this.orderModelPromise) {
      this.orderModelPromise = this.getConnection().then((connection) =>
        connection.models.Order
          ? (connection.models.Order as Model<MongoOrder>)
          : connection.model<MongoOrder>('Order', mongoOrderSchema),
      );
    }

    return this.orderModelPromise;
  }

  private async getProductModel(): Promise<Model<MongoProduct>> {
    if (!this.productModelPromise) {
      this.productModelPromise = this.getConnection().then((connection) =>
        connection.models.Product
          ? (connection.models.Product as Model<MongoProduct>)
          : connection.model<MongoProduct>('Product', mongoProductSchema),
      );
    }

    return this.productModelPromise;
  }

  private toOrderRecord(order: MongoOrder): OrderRecord {
    return {
      id: order._id,
      status: order.status,
      customerName: order.customerName,
      shippingAddress: order.shippingAddress,
      walletAddress: order.walletAddress,
      totalAmount: order.totalAmount,
      txHash: order.txHash,
      items: order.items.map((item) => this.toOrderItemRecord(item)),
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(order.updatedAt),
    };
  }

  private toOrderItemRecord(item: MongoOrderItem) {
    return {
      id: item._id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    };
  }
}
