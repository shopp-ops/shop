import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationQueryDto } from '../products/dto/pagination-query.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { OrdersService } from './orders.service';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Post(':id/verify-payment')
  verifyPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.ordersService.verifyPayment(id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: PaginationQueryDto) {
    return this.ordersService.findAll(query);
  }
}
