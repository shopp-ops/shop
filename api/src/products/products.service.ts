import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { NotFoundException } from '@nestjs/common';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PaginatedResponse } from './dto/paginated-response.dto';
import { PaginationMeta } from './dto/paginated-response.dto';
import { ILike } from 'typeorm';

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

  async findAll(
    paginationQuery: PaginationQueryDto,
  ): Promise<PaginatedResponse<Product>> {
    const { search, page = 1, limit = 20 } = paginationQuery;

    const [data, totalItems] = await this.repo.findAndCount({
      where: search ? [{ name: ILike(`%${search}%`) }] : undefined,
      take: limit,
      skip: (page - 1) * limit,
    });

    const meta: PaginationMeta = {
      totalItems,
      itemCount: data.length,
      itemsPerPage: limit,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };

    return {
      data: data,
      meta: meta,
    };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.repo.findOneBy({ id });
    if (!product) throw new NotFoundException(`Product #${id} not found`);
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, updateProductDto);
    return this.repo.save(product);
  }

  async remove(id: string): Promise<Product> {
    const product = await this.findOne(id);
    return this.repo.remove(product);
  }
}
