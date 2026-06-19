import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ORDER_MODEL,
  mongoOrderSchema,
} from '../orders/entities/mongo-order.schema';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { MongoOrdersRepository } from '../orders/repositories/mongo-orders.repository';
import { PostgresOrdersRepository } from '../orders/repositories/postgres-orders.repository';
import {
  PRODUCT_MODEL,
  mongoProductSchema,
} from '../products/entities/mongo-product.schema';
import { Product } from '../products/entities/product.entity';
import { MongoProductsRepository } from '../products/repositories/mongo-products.repository';
import { PostgresProductsRepository } from '../products/repositories/postgres-products.repository';

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var ${key}`);
  }
  return value;
};

/**
 * Wires BOTH database stacks unconditionally (ignores DB_MODE) so a migration
 * can read from one driver and write to the other in the same process.
 * Repos are provided by their concrete class so the Postgres and Mongo adapters
 * coexist (no abstract-token binding).
 */
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: requireEnv('POSTGRES_URL'),
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    TypeOrmModule.forFeature([Product, Order, OrderItem]),
    MongooseModule.forRoot(requireEnv('MONGO_URL')),
    MongooseModule.forFeature([
      { name: ORDER_MODEL, schema: mongoOrderSchema },
      { name: PRODUCT_MODEL, schema: mongoProductSchema },
    ]),
  ],
  providers: [
    PostgresProductsRepository,
    MongoProductsRepository,
    PostgresOrdersRepository,
    MongoOrdersRepository,
  ],
})
export class MigrationModule {}
