import { Entity, Column, PrimaryGeneratedColumn, OneToMany, OneToOne } from 'typeorm';
import { ProductUnit } from './product-unit.entity';
import { Inventory } from './inventory.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  sku: string;

  @Column()
  name: string;

  @Column()
  baseUnitName: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  costPrice: number;

  @OneToMany(() => ProductUnit, (unit) => unit.product, { cascade: true })
  units: ProductUnit[];

  @OneToOne(() => Inventory, (inventory) => inventory.product, { cascade: true })
  inventory: Inventory;
}
