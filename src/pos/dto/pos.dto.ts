import { UnitName } from '../enums/unit.enum';

export class CreateProductUnitDto {
  barcode: string;
  unitName: UnitName;
  multiplier: number;
  retailPrice: number;
  wholesalePrice: number;
}

export class CreateProductDto {
  sku: string;
  name: string;
  baseUnitName: UnitName;
  costPrice: number;
  units: CreateProductUnitDto[];
}

export class UpdateProductDto {
  sku?: string;
  name?: string;
  baseUnitName?: UnitName;
  costPrice?: number;
  units?: CreateProductUnitDto[];
  published?: boolean;
}

export class ReceiveGoodsDto {
  barcode: string;
  qty: number;
}

export class CheckoutItemDto {
  barcode: string;
  qty: number;
}

export class CheckoutDto {
  items: CheckoutItemDto[];
  referenceId?: string;
}
