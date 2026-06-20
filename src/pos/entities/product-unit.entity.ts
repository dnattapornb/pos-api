import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { UnitName } from '../enums/unit.enum';

@Entity()
export class ProductUnit {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, (product) => product.units, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ unique: true })
  barcode: string;

  @Column({ name: 'unit_name', type: 'enum', enum: UnitName })
  unitName: UnitName;

  @Column()
  multiplier: number;

  @Column('decimal', { name: 'retail_price', precision: 10, scale: 2 })
  retailPrice: number;

  @Column('decimal', { name: 'wholesale_price', precision: 10, scale: 2 })
  wholesalePrice: number;

  @Column({ default: true })
  published: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
