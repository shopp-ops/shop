import { PaginatedResponse } from '../../products/dto/paginated-response.dto';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderStatus } from '../entities/order.entity';

export interface OrderItemRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number | string;
}

export interface OrderRecord {
  id: string;
  status: OrderStatus;
  customerName: string;
  shippingAddress: {
    street: string;
    city: string;
    country: string;
    zip: string;
  };
  walletAddress: string;
  totalAmount: number | string;
  txHash: string | null;
  items: OrderItemRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderResult {
  orderId: string;
  totalAmount: string;
}

export abstract class OrdersRepository {
  abstract create(
    dto: CreateOrderDto,
    ethUsdRate: number,
  ): Promise<CreateOrderResult>;
  abstract findOne(id: string): Promise<OrderRecord | null>;
  abstract save(order: OrderRecord): Promise<OrderRecord>;
  abstract restoreStockAndSetStatus(
    orderId: string,
    status: OrderStatus.CANCELLED | OrderStatus.EXPIRED,
  ): Promise<OrderRecord | null>;
  abstract findStalePending(cutoff: Date): Promise<OrderRecord[]>;
  abstract findAll(query: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<OrderRecord>>;
}
