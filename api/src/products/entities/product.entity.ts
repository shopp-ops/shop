import { Entity, Column, PrimaryGeneratedColumn, Check } from 'typeorm';

@Entity()
@Check(`quantity >= 0 AND price > 0`)
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column()
  quantity: number;

  @Column('decimal')
  price: number;
}
