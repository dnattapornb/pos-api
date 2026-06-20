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
