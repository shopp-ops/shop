import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private repo: Repository<Product>) {}

  create(createProductDto: CreateProductDto) {
    const product = this.repo.create({
      ...createProductDto,
      quantity: createProductDto.quantity ?? 0,
    });
    return this.repo.save(product);
  }

  findAll(): Promise<Product[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.repo.findOneBy({ id });
    if (!product) throw new NotFoundException(`Product #${id} not found`);
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(id);
    return this.repo.update(id, updateProductDto);
  }

  async remove(id: string): Promise<Product> {
    const product = await this.findOne(id);
    return this.repo.remove(product);
  }
}
