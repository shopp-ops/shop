import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { isStandardDatabaseDriver } from './database/database-driver';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';

const useStandardDatabase = isStandardDatabaseDriver();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    ProductsModule,
    OrdersModule,
    ...(useStandardDatabase
      ? [
          TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              type: 'postgres' as const,
              url: config.getOrThrow<string>('DATABASE_URL'),
              autoLoadEntities: true,
              synchronize: true,
            }),
          }),
        ]
      : [
          MongooseModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              uri: config.getOrThrow<string>('DATABASE_URL'),
            }),
          }),
        ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
