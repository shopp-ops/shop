import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const PRODUCT_MODEL = 'Product';

@Schema({ versionKey: false, collection: 'products' })
export class MongoProduct {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0, default: 0 })
  quantity: number;

  @Prop({ required: true, min: 0.01 })
  price: number;
}

export type MongoProductDocument = HydratedDocument<MongoProduct>;
export const mongoProductSchema = SchemaFactory.createForClass(MongoProduct);
