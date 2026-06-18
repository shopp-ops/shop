import { Schema } from 'mongoose';
import { OrderStatus } from './order.entity';

export interface MongoOrderItem {
  _id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface MongoOrder {
  _id: string;
  status: OrderStatus;
  customerName: string;
  shippingAddress: {
    street: string;
    city: string;
    country: string;
    zip: string;
  };
  walletAddress: string;
  totalAmount: number;
  txHash: string | null;
  items: MongoOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

export const mongoOrderItemSchema = new Schema<MongoOrderItem>(
  {
    _id: { type: String, required: true },
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  {
    _id: false,
    id: false,
    versionKey: false,
  },
);

export const mongoOrderSchema = new Schema<MongoOrder>(
  {
    _id: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      required: true,
      default: OrderStatus.PENDING,
    },
    customerName: { type: String, required: true },
    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      country: { type: String, required: true },
      zip: { type: String, required: true },
    },
    walletAddress: { type: String, required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    txHash: { type: String, default: null },
    items: {
      type: [mongoOrderItemSchema],
      required: true,
      validate: {
        validator: (items: MongoOrderItem[]) => items.length > 0,
        message: 'Order must contain at least one item',
      },
    },
  },
  {
    versionKey: false,
    collection: 'orders',
    timestamps: true,
  },
);
