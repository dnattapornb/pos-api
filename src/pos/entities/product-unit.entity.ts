import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Product } from './product.entity';

@Entity()
export class ProductUnit {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, (product) => product.units, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Index()
  @Column({ unique: true })
  barcode: string;

  @Column()
  unitName: string;

  @Column()
  multiplier: number;

  @Column('decimal', { precision: 10, scale: 2 })
  retailPrice: number;

  @Column('decimal', { precision: 10, scale: 2 })
  wholesalePrice: number;
}
