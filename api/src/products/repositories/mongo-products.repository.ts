import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  Connection,
  HydratedDocument,
  Model,
  createConnection,
} from 'mongoose';
import { CreateProductDto } from '../dto/create-product.dto';
import {
  PaginatedResponse,
  PaginationMeta,
} from '../dto/paginated-response.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import {
  MongoProduct,
  mongoProductSchema,
} from '../entities/mongo-product.schema';
import { ProductRecord, ProductsRepository } from './products.repository';

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class MongoProductsRepository
  extends ProductsRepository
  implements OnModuleDestroy
{
  private connection?: Connection;
  private connectionPromise?: Promise<Connection>;
  private modelPromise?: Promise<Model<MongoProduct>>;

  constructor(private readonly config: ConfigService) {
    super();
  }

  async create(createProductDto: CreateProductDto): Promise<ProductRecord> {
    const ProductModel = await this.getModel();
    const created = await ProductModel.create({
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
    const ProductModel = await this.getModel();
    const { search, page = 1, limit = 20 } = paginationQuery;
    const filter = search
      ? {
          name: { $regex: escapeRegExp(search), $options: 'i' },
        }
      : {};

    const [data, totalItems] = await Promise.all([
      ProductModel.find(filter)
        .sort({ _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      ProductModel.countDocuments(filter).exec(),
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
    const ProductModel = await this.getModel();
    const product = await ProductModel.findById(id).lean().exec();

    return product ? this.toProductRecord(product) : null;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductRecord | null> {
    const ProductModel = await this.getModel();
    const updated = await ProductModel.findByIdAndUpdate(id, updateProductDto, {
      returnDocument: 'after',
      runValidators: true,
    })
      .lean()
      .exec();

    return updated ? this.toProductRecord(updated) : null;
  }

  async remove(id: string): Promise<ProductRecord | null> {
    const ProductModel = await this.getModel();
    const deleted = await ProductModel.findByIdAndDelete(id).lean().exec();

    return deleted ? this.toProductRecord(deleted) : null;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
    }
  }

  private async getConnection(): Promise<Connection> {
    if (this.connection) {
      return this.connection;
    }

    if (!this.connectionPromise) {
      const uri = this.config.getOrThrow<string>('MONGODB_URL');
      this.connectionPromise = createConnection(uri)
        .asPromise()
        .then((connection) => {
          this.connection = connection;
          return connection;
        });
    }

    return this.connectionPromise;
  }

  private async getModel(): Promise<Model<MongoProduct>> {
    if (!this.modelPromise) {
      this.modelPromise = this.getConnection().then((connection) =>
        connection.models.Product
          ? (connection.models.Product as Model<MongoProduct>)
          : connection.model<MongoProduct>('Product', mongoProductSchema),
      );
    }

    return this.modelPromise;
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
