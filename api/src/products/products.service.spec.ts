import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  ProductRecord,
  ProductsRepository,
} from './repositories/products.repository';
import { ProductsService } from './products.service';

const makeProduct = (
  overrides: Partial<ProductRecord> = {},
): ProductRecord => ({
  id: 'uuid-1',
  name: 'Keyboard',
  quantity: 5,
  price: 99.99,
  ...overrides,
});

describe('ProductsService', () => {
  let service: ProductsService;
  let repo: jest.Mocked<ProductsRepository>;

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: ProductsRepository,
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('create', () => {
    it('delegates creation to the active products repository', async () => {
      const dto: CreateProductDto = {
        name: 'Keyboard',
        price: 99.99,
      };
      const saved = makeProduct({ quantity: 0 });

      repo.create.mockResolvedValue(saved);

      const result = await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(saved);
    });

    it('keeps provided quantity', async () => {
      const dto: CreateProductDto = {
        name: 'Mouse',
        quantity: 12,
        price: 49.99,
      };
      const saved = makeProduct({ name: 'Mouse', quantity: 12, price: 49.99 });

      repo.create.mockResolvedValue(saved);

      const result = await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(saved);
    });
  });

  describe('findAll', () => {
    it('returns paginated products', async () => {
      const products = [
        makeProduct(),
        makeProduct({ id: 'uuid-2', name: 'Mouse' }),
      ];
      const response = {
        data: products,
        meta: {
          totalItems: 2,
          itemCount: 2,
          itemsPerPage: 20,
          totalPages: 1,
          currentPage: 1,
        },
      };

      repo.findAll.mockResolvedValue(response);

      const result = await service.findAll({});

      expect(repo.findAll).toHaveBeenCalledWith({});
      expect(result).toEqual(response);
    });

    it('forwards search and pagination options', async () => {
      repo.findAll.mockResolvedValue({
        data: [makeProduct({ name: 'Laptop' })],
        meta: {
          totalItems: 1,
          itemCount: 1,
          itemsPerPage: 20,
          totalPages: 1,
          currentPage: 1,
        },
      });

      await service.findAll({
        search: 'Lap',
        page: 1,
        limit: 20,
      });

      expect(repo.findAll).toHaveBeenCalledWith({
        search: 'Lap',
        page: 1,
        limit: 20,
      });
    });
  });

  describe('findOne', () => {
    it('returns a product when it exists', async () => {
      const product = makeProduct();
      repo.findOne.mockResolvedValue(product);

      const result = await service.findOne('uuid-1');

      expect(result).toEqual(product);
      expect(repo.findOne).toHaveBeenCalledWith('uuid-1');
    });

    it('throws NotFoundException when product does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('uuid-404')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('delegates the update to the active repository', async () => {
      const dto: UpdateProductDto = { name: 'Updated keyboard' };
      const updated = makeProduct({ name: 'Updated keyboard' });

      repo.update.mockResolvedValue(updated);

      const result = await service.update('uuid-1', dto);

      expect(repo.update).toHaveBeenCalledWith('uuid-1', dto);
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when the product to edit does not exist', async () => {
      repo.update.mockResolvedValue(null);

      await expect(
        service.update('uuid-404', { name: 'Updated keyboard' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes the existing product', async () => {
      const product = makeProduct();
      repo.remove.mockResolvedValue(product);

      const result = await service.remove('uuid-1');

      expect(result).toEqual(product);
      expect(repo.remove).toHaveBeenCalledWith('uuid-1');
    });

    it('throws NotFoundException when the product to delete does not exist', async () => {
      repo.remove.mockResolvedValue(null);

      await expect(service.remove('uuid-404')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
