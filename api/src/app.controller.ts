import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api/config')
  getConfig() {
    return {
      shopWalletAddress:
        this.configService.getOrThrow<string>('WALLET_ADDRESS'),
      shopName: this.configService.getOrThrow<string>('SHOP_NAME') ?? 'SHOP',
    };
  }
}
