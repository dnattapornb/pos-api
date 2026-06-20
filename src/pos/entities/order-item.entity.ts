import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { ProductUnit } from './product-unit.entity';

@Entity()
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'product_unit_id' })
  productUnitId: number;

  @ManyToOne(() => ProductUnit)
  @JoinColumn({ name: 'product_unit_id' })
  productUnit: ProductUnit;

  @Column()
  qty: number;

  @Column('decimal', {
    name: 'unit_price',
    precision: 10,
    scale: 2,
    default: 0,
  })
  unitPrice: number;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0,
  })
  subtotal: number;
}
