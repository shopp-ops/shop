import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { MongoProductsRepository } from './repositories/mongo-products.repository';
import { PostgresProductsRepository } from './repositories/postgres-products.repository';
import { ProductsRepository } from './repositories/products.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    PostgresProductsRepository,
    MongoProductsRepository,
    {
      provide: ProductsRepository,
      useFactory: (
        configService: ConfigService,
        postgresProductsRepository: PostgresProductsRepository,
        mongoProductsRepository: MongoProductsRepository,
      ) => {
        const driver =
          configService.get<string>('PRODUCTS_DB_DRIVER')?.toLowerCase() ??
          'postgres';

        return driver === 'mongo'
          ? mongoProductsRepository
          : postgresProductsRepository;
      },
      inject: [
        ConfigService,
        PostgresProductsRepository,
        MongoProductsRepository,
      ],
    },
  ],
  exports: [ProductsRepository],
})
export class ProductsModule {}
