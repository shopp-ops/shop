import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { HydratedDocument, Model } from 'mongoose';
import { CreateProductDto } from '../dto/create-product.dto';
import {
  PaginatedResponse,
  PaginationMeta,
} from '../dto/paginated-response.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { MongoProduct, PRODUCT_MODEL } from '../entities/mongo-product.schema';
import { ProductRecord, ProductsRepository } from './products.repository';

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class MongoProductsRepository extends ProductsRepository {
  constructor(
    @InjectModel(PRODUCT_MODEL)
    private readonly productModel: Model<MongoProduct>,
  ) {
    super();
  }

  async create(createProductDto: CreateProductDto): Promise<ProductRecord> {
    const created = await this.productModel.create({
      _id: randomUUID(),
      name: createProductDto.name,
      quantity: createProductDto.quantity ?? 0,
      price: createProductDto.price,
    });

    return this.toProductRecord(created);
  }

  async findAll(
    paginationQuery: PaginationQueryDto,
  ): Promise<PaginatedResponse<ProductRecord>> {
    const { search, page = 1, limit = 20 } = paginationQuery;
    const filter = search
      ? {
          name: { $regex: escapeRegExp(search), $options: 'i' },
        }
      : {};

    const [data, totalItems] = await Promise.all([
      this.productModel
        .find(filter)
        .sort({ _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    const meta: PaginationMeta = {
      totalItems,
      itemCount: data.length,
      itemsPerPage: limit,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };

    return {
      data: data.map((product) => this.toProductRecord(product)),
      meta,
    };
  }

  async findOne(id: string): Promise<ProductRecord | null> {
    const product = await this.productModel.findById(id).lean().exec();

    return product ? this.toProductRecord(product) : null;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductRecord | null> {
    const updated = await this.productModel
      .findByIdAndUpdate(id, updateProductDto, {
        returnDocument: 'after',
        runValidators: true,
      })
      .lean()
      .exec();

    return updated ? this.toProductRecord(updated) : null;
  }

  async remove(id: string): Promise<ProductRecord | null> {
    const deleted = await this.productModel.findByIdAndDelete(id).lean().exec();

    return deleted ? this.toProductRecord(deleted) : null;
  }

  async insert(record: ProductRecord): Promise<void> {
    await this.productModel.create({
      _id: record.id,
      name: record.name,
      quantity: record.quantity,
      price: Number(record.price),
    });
  }

  async clear(): Promise<void> {
    await this.productModel.deleteMany({}).exec();
  }

  private toProductRecord(
    product:
      | HydratedDocument<MongoProduct>
      | MongoProduct
      | (MongoProduct & { _id: string }),
  ): ProductRecord {
    return {
      id: product._id,
      name: product.name,
      quantity: product.quantity,
      price: product.price,
    };
  }
}
