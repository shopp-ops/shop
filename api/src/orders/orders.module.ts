import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isStandardDatabaseDriver } from '../database/database-driver';
import {
  PRODUCT_MODEL,
  mongoProductSchema,
} from '../products/entities/mongo-product.schema';
import { ORDER_MODEL, mongoOrderSchema } from './entities/mongo-order.schema';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { MongoOrdersRepository } from './repositories/mongo-orders.repository';
import { OrdersRepository } from './repositories/orders.repository';
import { PostgresOrdersRepository } from './repositories/postgres-orders.repository';

const useStandardDatabase = isStandardDatabaseDriver();

@Module({
  imports: useStandardDatabase
    ? [TypeOrmModule.forFeature([Order, OrderItem])]
    : [
        MongooseModule.forFeature([
          { name: ORDER_MODEL, schema: mongoOrderSchema },
          { name: PRODUCT_MODEL, schema: mongoProductSchema },
        ]),
      ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    useStandardDatabase
      ? {
          provide: OrdersRepository,
          useClass: PostgresOrdersRepository,
        }
      : {
          provide: OrdersRepository,
          useClass: MongoOrdersRepository,
        },
  ],
})
export class OrdersModule {}
