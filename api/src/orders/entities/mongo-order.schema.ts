import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { OrderStatus } from './order.entity';

export const ORDER_MODEL = 'Order';

@Schema({ _id: false, id: false, versionKey: false })
export class MongoOrderItem {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true })
  productId: string;

  @Prop({ required: true })
  productName: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitPrice: number;
}

export const mongoOrderItemSchema =
  SchemaFactory.createForClass(MongoOrderItem);

@Schema({ _id: false, versionKey: false })
export class ShippingAddress {
  @Prop({ required: true })
  street: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  country: string;

  @Prop({ required: true })
  zip: string;
}

export const shippingAddressSchema =
  SchemaFactory.createForClass(ShippingAddress);

@Schema({ versionKey: false, collection: 'orders', timestamps: true })
export class MongoOrder {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({
    type: String,
    enum: Object.values(OrderStatus),
    required: true,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Prop({ required: true })
  customerName: string;

  @Prop({ type: shippingAddressSchema, required: true })
  shippingAddress: ShippingAddress;

  @Prop({ required: true })
  walletAddress: string;

  @Prop({ type: Number, required: true, min: 0 })
  totalAmount: number;

  @Prop({ type: String, default: null })
  txHash: string | null;

  @Prop({
    type: [mongoOrderItemSchema],
    required: true,
    validate: {
      validator: (items: MongoOrderItem[]) => items.length > 0,
      message: 'Order must contain at least one item',
    },
  })
  items: MongoOrderItem[];

  createdAt: Date;

  updatedAt: Date;
}

export type MongoOrderDocument = HydratedDocument<MongoOrder>;
export const mongoOrderSchema = SchemaFactory.createForClass(MongoOrder);
