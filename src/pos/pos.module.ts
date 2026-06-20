import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { Product } from './entities/product.entity';
import { ProductUnit } from './entities/product-unit.entity';
import { Inventory } from './entities/inventory.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductUnit,
      Inventory,
      InventoryTransaction,
    ]),
  ],
  controllers: [PosController],
  providers: [PosService],
})
export class PosModule {}
