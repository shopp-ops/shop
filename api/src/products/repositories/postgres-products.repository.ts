import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CreateProductDto } from '../dto/create-product.dto';
import {
  PaginatedResponse,
  PaginationMeta,
} from '../dto/paginated-response.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { Product } from '../entities/product.entity';
import { ProductRecord, ProductsRepository } from './products.repository';

@Injectable()
export class PostgresProductsRepository extends ProductsRepository {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
  ) {
    super();
  }

  async create(createProductDto: CreateProductDto): Promise<ProductRecord> {
    const product = this.repo.create({
      ...createProductDto,
      quantity: createProductDto.quantity ?? 0,
    });

    return this.repo.save(product);
  }

  async findAll(
    paginationQuery: PaginationQueryDto,
  ): Promise<PaginatedResponse<ProductRecord>> {
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
      data,
      meta,
    };
  }

  findOne(id: string): Promise<ProductRecord | null> {
    return this.repo.findOneBy({ id });
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductRecord | null> {
    const product = await this.repo.findOneBy({ id });
    if (!product) {
      return null;
    }

    Object.assign(product, updateProductDto);
    return this.repo.save(product);
  }

  async remove(id: string): Promise<ProductRecord | null> {
    const product = await this.repo.findOneBy({ id });
    if (!product) {
      return null;
    }

    return this.repo.remove(product);
  }
}
