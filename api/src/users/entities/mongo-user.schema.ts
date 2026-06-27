import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const USER_MODEL = 'User';

@Schema({ versionKey: false, collection: 'users' })
export class MongoUser {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, default: true })
  mustChangePassword: boolean;

  @Prop({ required: true, default: 'admin' })
  role: string;
}

export type MongoUserDocument = HydratedDocument<MongoUser>;
export const mongoUserSchema = SchemaFactory.createForClass(MongoUser);
