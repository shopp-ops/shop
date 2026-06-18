import { Schema } from 'mongoose';

export interface MongoProduct {
  _id: string;
  name: string;
  quantity: number;
  price: number;
}

export const mongoProductSchema = new Schema<MongoProduct>(
  {
    _id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0.01,
    },
  },
  {
    versionKey: false,
    collection: 'products',
  },
);
