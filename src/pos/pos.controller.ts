import { Controller, Get, Post, Body } from '@nestjs/common';
import { PosService } from './pos.service';
import { ReceiveGoodsDto, CheckoutDto } from './dto/pos.dto';

@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get('products')
  getAllProducts() {
    return this.posService.getAllProducts();
  }

  @Post('seed')
  seedProducts() {
    return this.posService.seedProducts();
  }

  @Post('inventory/receive')
  receiveGoods(@Body() dto: ReceiveGoodsDto) {
    return this.posService.receiveGoods(dto);
  }

  @Post('checkout')
  checkout(@Body() dto: CheckoutDto) {
    return this.posService.checkout(dto);
  }
}
