import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';

const makeProduct = (overrides: Partial<Product> = {}): Product =>
  Object.assign(new Product(), {
    id: 'uuid-1',
    name: 'Keyboard',
    quantity: 5,
    price: '99.99',
    ...overrides,
  });

describe('ProductsService', () => {
  let service: ProductsService;
  let repo: jest.Mocked<
    Pick<
      Repository<Product>,
      'create' | 'save' | 'find' | 'findOneBy' | 'remove'
    >
  >;

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('create', () => {
    it('defaults quantity to 0 when omitted', async () => {
      const dto: CreateProductDto = {
        name: 'Keyboard',
        price: 99.99,
      };
      const saved = makeProduct({ quantity: 0 });

      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);

      await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith({
        name: 'Keyboard',
        price: 99.99,
        quantity: 0,
      });
    });

    it('keeps provided quantity', async () => {
      const dto: CreateProductDto = {
        name: 'Mouse',
        quantity: 12,
        price: 49.99,
      };
      const saved = makeProduct({ name: 'Mouse', quantity: 12, price: 49.99 });

      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);

      const result = await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(saved);
    });
  });

  describe('findAll', () => {
    it('returns all products', async () => {
      const products = [
        makeProduct(),
        makeProduct({ id: 'uuid-2', name: 'Mouse' }),
      ];
      repo.find.mockResolvedValue(products);

      const result = await service.findAll();

      expect(result).toEqual(products);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns a product when it exists', async () => {
      const product = makeProduct();
      repo.findOneBy.mockResolvedValue(product);

      const result = await service.findOne('uuid-1');

      expect(result).toEqual(product);
      expect(repo.findOneBy).toHaveBeenCalledWith({ id: 'uuid-1' });
    });

    it('throws NotFoundException when product does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('uuid-404')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('loads the product before updating it', async () => {
      const product = makeProduct();
      const dto: UpdateProductDto = { name: 'Updated keyboard' };
      const updated = makeProduct({ name: 'Updated keyboard' });

      repo.findOneBy.mockResolvedValue(product);
      repo.save.mockResolvedValue(updated);

      const result = await service.update('uuid-1', dto);

      expect(repo.findOneBy).toHaveBeenCalledWith({ id: 'uuid-1' });
      expect(repo.save).toHaveBeenCalledWith({
        ...product,
        ...dto,
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when the product to edit does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('uuid-404', { name: 'Updated keyboard' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes the existing product', async () => {
      const product = makeProduct();
      repo.findOneBy.mockResolvedValue(product);
      repo.remove.mockResolvedValue(product);

      const result = await service.remove('uuid-1');

      expect(result).toEqual(product);
      expect(repo.remove).toHaveBeenCalledWith(product);
    });

    it('throws NotFoundException when the product to delete does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.remove('uuid-404')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
