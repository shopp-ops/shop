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
import { UsersModule } from './users/users.module';
import { LoggerModule } from 'nestjs-pino';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsInterceptor } from './metrics/metrics.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

const useStandardDatabase = isStandardDatabaseDriver();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'info',
        base: {
          shop: process.env.SHOP_NAME ?? 'unknown',
        },
        serializers: {
          req(req) {
            return {
              method: req.method,
              url: req.url,
              userAgent: req.headers['user-agent'],
              ip: req.headers['x-forwarded-for'] ?? req.ip,
            };
          },
        },
      },
    }),
    PrometheusModule.register({
      path:'/metrics'
    }),
    AuthModule,
    ProductsModule,
    OrdersModule,
    UsersModule,
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
  providers: [AppService, 
              {
                provide: APP_INTERCEPTOR,
                useClass: MetricsInterceptor,
              }
  ],
})
export class AppModule {}
