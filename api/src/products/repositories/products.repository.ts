import { CreateProductDto } from '../dto/create-product.dto';
import { PaginatedResponse } from '../dto/paginated-response.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { UpdateProductDto } from '../dto/update-product.dto';

export interface ProductRecord {
  id: string;
  name: string;
  quantity: number;
  price: number | string;
}

export abstract class ProductsRepository {
  abstract create(createProductDto: CreateProductDto): Promise<ProductRecord>;
  abstract findAll(
    paginationQuery: PaginationQueryDto,
  ): Promise<PaginatedResponse<ProductRecord>>;
  abstract findOne(id: string): Promise<ProductRecord | null>;
  abstract update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductRecord | null>;
  abstract remove(id: string): Promise<ProductRecord | null>;
}
