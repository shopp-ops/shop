import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isStandardDatabaseDriver } from '../database/database-driver';
import {
  PRODUCT_MODEL,
  mongoProductSchema,
} from './entities/mongo-product.schema';
import { Product } from './entities/product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { MongoProductsRepository } from './repositories/mongo-products.repository';
import { PostgresProductsRepository } from './repositories/postgres-products.repository';
import { ProductsRepository } from './repositories/products.repository';

const useStandardDatabase = isStandardDatabaseDriver();

@Module({
  imports: useStandardDatabase
    ? [TypeOrmModule.forFeature([Product])]
    : [
        MongooseModule.forFeature([
          { name: PRODUCT_MODEL, schema: mongoProductSchema },
        ]),
      ],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    useStandardDatabase
      ? {
          provide: ProductsRepository,
          useClass: PostgresProductsRepository,
        }
      : {
          provide: ProductsRepository,
          useClass: MongoProductsRepository,
        },
  ],
  exports: [ProductsRepository],
})
export class ProductsModule {}
