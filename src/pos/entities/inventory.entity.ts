import { Entity, Column, PrimaryColumn, OneToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity()
export class Inventory {
  @PrimaryColumn()
  productId: number;

  @OneToOne(() => Product, (product) => product.inventory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int', default: 0 })
  qtyInBaseUnit: number;
}
