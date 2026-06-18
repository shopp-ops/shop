import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isStandardDatabaseDriver } from '../database/database-driver';
import { Product } from './entities/product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { MongoProductsRepository } from './repositories/mongo-products.repository';
import { PostgresProductsRepository } from './repositories/postgres-products.repository';
import { ProductsRepository } from './repositories/products.repository';

const useStandardDatabase = isStandardDatabaseDriver();

@Module({
  imports: useStandardDatabase ? [TypeOrmModule.forFeature([Product])] : [],
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
