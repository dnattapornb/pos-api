import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe } from '@nestjs/common';
import { PosService } from './pos.service';
import { ReceiveGoodsDto, CheckoutDto, CreateProductDto, UpdateProductDto } from './dto/pos.dto';

@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get('products')
  async getAllProducts() {
    return this.posService.getAllProducts();
  }

  @Get('product/:id')
  async getProductById(@Param('id', ParseIntPipe) id: number) {
    return this.posService.getProductById(id);
  }

  @Post('product')
  async createProduct(@Body() dto: CreateProductDto) {
    return this.posService.createProduct(dto);
  }

  @Put('product/:id')
  async updateProduct(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.posService.updateProduct(id, dto);
  }

  @Delete('product/:id')
  async deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.posService.deleteProduct(id);
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
