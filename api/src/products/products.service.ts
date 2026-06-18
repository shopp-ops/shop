import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PaginatedResponse } from './dto/paginated-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  ProductRecord,
  ProductsRepository,
} from './repositories/products.repository';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  create(createProductDto: CreateProductDto): Promise<ProductRecord> {
    return this.productsRepository.create(createProductDto);
  }

  findAll(
    paginationQuery: PaginationQueryDto,
  ): Promise<PaginatedResponse<ProductRecord>> {
    return this.productsRepository.findAll(paginationQuery);
  }

  async findOne(id: string): Promise<ProductRecord> {
    const product = await this.productsRepository.findOne(id);
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }

    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductRecord> {
    const product = await this.productsRepository.update(id, updateProductDto);
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }

    return product;
  }

  async remove(id: string): Promise<ProductRecord> {
    const product = await this.productsRepository.remove(id);
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }

    return product;
  }
}
