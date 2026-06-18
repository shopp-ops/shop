import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isStandardDatabaseDriver } from '../database/database-driver';
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
    : [],
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
