import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;
  let productsService: jest.Mocked<ProductsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    productsService = module.get(ProductsService);
  });

  describe('create', () => {
    it('delegates to ProductsService and returns the result', async () => {
      const dto = { name: 'Keyboard', price: 99.99 };
      productsService.create.mockResolvedValue({
        id: 'uuid-1',
        ...dto,
        quantity: 0,
      });

      const result = await controller.create(dto);

      expect(productsService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        id: 'uuid-1',
        ...dto,
        quantity: 0,
      });
    });
  });

  describe('findAll', () => {
    it('returns paginated products from the service', async () => {
      const response = {
        data: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: 20,
          totalPages: 0,
          currentPage: 1,
        },
      };

      productsService.findAll.mockResolvedValue(response);

      const query = {
        search: 'Lap',
        page: 1,
        limit: 20,
      };

      const result = await controller.findAll(query);

      expect(productsService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(response);
    });
  });

  describe('findOne', () => {
    it('delegates lookup to the service', async () => {
      const product = {
        id: 'uuid-1',
        name: 'Keyboard',
        quantity: 1,
        price: 99.99,
      };
      productsService.findOne.mockResolvedValue(product);

      const result = await controller.findOne('uuid-1');

      expect(productsService.findOne).toHaveBeenCalledWith('uuid-1');
      expect(result).toEqual(product);
    });
  });

  describe('update', () => {
    it('delegates update to the service', async () => {
      const dto = { name: 'Updated keyboard' };
      const product = {
        id: 'uuid-1',
        name: 'Updated keyboard',
        quantity: 1,
        price: 99.99,
      };
      productsService.update.mockResolvedValue(product);

      const result = await controller.update('uuid-1', dto);

      expect(productsService.update).toHaveBeenCalledWith('uuid-1', dto);
      expect(result).toEqual(product);
    });
  });

  describe('remove', () => {
    it('delegates removal to the service', async () => {
      const product = {
        id: 'uuid-1',
        name: 'Keyboard',
        quantity: 1,
        price: 99.99,
      };
      productsService.remove.mockResolvedValue(product);

      const result = await controller.remove('uuid-1');

      expect(productsService.remove).toHaveBeenCalledWith('uuid-1');
      expect(result).toEqual(product);
    });
  });
});
