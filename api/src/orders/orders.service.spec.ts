import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { OrderItem } from './entities/order-item.entity';
import { Order, OrderStatus } from './entities/order.entity';
import { LessThan } from 'typeorm';
import { OrdersService } from './orders.service';

const makeOrder = (overrides: Partial<Order> = {}): Order =>
  Object.assign(new Order(), {
    id: 'order-uuid-1',
    status: OrderStatus.PENDING,
    customerName: 'Alice Smith',
    shippingAddress: {
      street: '1 Main St',
      city: 'Berlin',
      country: 'DE',
      zip: '10115',
    },
    walletAddress: '0xabc',
    totalAmount: '0.05',
    txHash: null,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepo: jest.Mocked<
    Pick<Repository<Order>, 'find' | 'findOne' | 'save' | 'findAndCount'>
  >;
  let mockManager: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; increment: jest.Mock };

  beforeEach(async () => {
    mockManager = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      increment: jest.fn().mockResolvedValue(undefined),
    };

    orderRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(OrderItem), useValue: {} },
        {
          provide: DataSource,
          useValue: {
            transaction: jest
              .fn()
              .mockImplementation(
                async (cb: (m: typeof mockManager) => Promise<unknown>) =>
                  cb(mockManager),
              ),
          },
        },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('0xSHOP_WALLET') },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('create', () => {
    const dto: CreateOrderDto = {
      customerName: 'Alice Smith',
      shippingAddress: {
        street: '1 Main St',
        city: 'Berlin',
        country: 'DE',
        zip: '10115',
      },
      walletAddress: '0xabc',
      items: [{ productId: 'prod-1', quantity: 2 }],
    };

    it('creates order and decrements stock inside a transaction', async () => {
      const product = {
        id: 'prod-1',
        name: 'Widget',
        quantity: 5,
        price: '50.00',  // USD price
      };
      mockManager.findOne.mockResolvedValue(product);
      mockManager.create.mockImplementation(
        (_entity: unknown, data: unknown) => data,
      );
      mockManager.save.mockImplementation((entity: unknown) => {
        if (entity && typeof entity === 'object' && 'status' in entity) {
          return { ...(entity as object), id: 'order-uuid-1' };
        }
        return entity;
      });
      // ETH/USD = 2000 → 100 USD / 2000 = 0.05 ETH
      jest.spyOn(service as unknown as { getEthUsdRate: () => Promise<number> }, 'getEthUsdRate')
        .mockResolvedValue(2000);

      const result = await service.create(dto);

      expect(mockManager.findOne).toHaveBeenCalled();
      expect(mockManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 3 }),
      );
      expect(result).toEqual({
        orderId: 'order-uuid-1',
        totalAmount: '0.05',
        shopWalletAddress: '0xSHOP_WALLET',
      });
    });

    it('throws ConflictException when stock is insufficient', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 'prod-1',
        name: 'Widget',
        quantity: 1,
        price: '0.025',
      });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when product does not exist', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyPayment', () => {
    const dto: VerifyPaymentDto = { txHash: '0x' + 'a'.repeat(64) };

    it('confirms order when tx is valid', async () => {
      orderRepo.findOne.mockResolvedValue(makeOrder());
      orderRepo.save.mockImplementation(async (o) => o as Order);

      jest.spyOn(service['viemClient'], 'getTransaction').mockResolvedValue({
        to: '0xSHOP_WALLET',
        value: BigInt('50000000000000000'),
      } as never);
      jest
        .spyOn(service['viemClient'], 'getTransactionReceipt')
        .mockResolvedValue({
          status: 'success',
        } as never);

      const result = await service.verifyPayment('order-uuid-1', dto);

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(result.txHash).toBe(dto.txHash);
    });

    it('marks order as failed and throws when recipient is wrong', async () => {
      orderRepo.findOne.mockResolvedValue(makeOrder());
      orderRepo.save.mockImplementation(async (o) => o as Order);

      jest.spyOn(service['viemClient'], 'getTransaction').mockResolvedValue({
        to: '0xWRONG',
        value: BigInt('50000000000000000'),
      } as never);
      jest
        .spyOn(service['viemClient'], 'getTransactionReceipt')
        .mockResolvedValue({
          status: 'success',
        } as never);

      await expect(service.verifyPayment('order-uuid-1', dto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('marks order as failed and throws when value is insufficient', async () => {
      orderRepo.findOne.mockResolvedValue(makeOrder());
      orderRepo.save.mockImplementation(async (o) => o as Order);

      jest.spyOn(service['viemClient'], 'getTransaction').mockResolvedValue({
        to: '0xSHOP_WALLET',
        value: BigInt('1'),
      } as never);
      jest
        .spyOn(service['viemClient'], 'getTransactionReceipt')
        .mockResolvedValue({
          status: 'success',
        } as never);

      await expect(service.verifyPayment('order-uuid-1', dto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('throws NotFoundException when order does not exist', async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyPayment('order-uuid-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancel', () => {
    it('restores stock and sets status to CANCELLED', async () => {
      const order = makeOrder({
        items: [
          Object.assign(new OrderItem(), { productId: 'prod-1', quantity: 2 }),
        ],
      });
      orderRepo.findOne.mockResolvedValue(order);
      mockManager.save.mockImplementation(async (o) => o as Order);

      const result = await service.cancel('order-uuid-1');

      expect(mockManager.increment).toHaveBeenCalledWith(
        expect.anything(),
        { id: 'prod-1' },
        'quantity',
        2,
      );
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('throws NotFoundException when order does not exist', async () => {
      orderRepo.findOne.mockResolvedValue(null);
      await expect(service.cancel('order-uuid-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when order is not pending', async () => {
      orderRepo.findOne.mockResolvedValue(makeOrder({ status: OrderStatus.CONFIRMED }));
      await expect(service.cancel('order-uuid-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('expireStaleOrders', () => {
    it('expires stale pending orders and restores stock', async () => {
      const order = makeOrder({
        items: [
          Object.assign(new OrderItem(), { productId: 'prod-1', quantity: 3 }),
        ],
      });
      orderRepo.find.mockResolvedValue([order]);
      mockManager.save.mockImplementation(async (o) => o as Order);

      await service.expireStaleOrders();

      expect(orderRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: OrderStatus.PENDING }),
        }),
      );
      expect(mockManager.increment).toHaveBeenCalledWith(
        expect.anything(),
        { id: 'prod-1' },
        'quantity',
        3,
      );
    });

    it('does nothing when no stale orders exist', async () => {
      orderRepo.find.mockResolvedValue([]);
      await service.expireStaleOrders();
      expect(mockManager.increment).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns paginated orders sorted newest first', async () => {
      const orders = [makeOrder(), makeOrder({ id: 'order-uuid-2' })];
      orderRepo.findAndCount.mockResolvedValue([orders, 2]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(orderRepo.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
      expect(result).toEqual({
        data: orders,
        meta: {
          totalItems: 2,
          itemCount: 2,
          itemsPerPage: 20,
          totalPages: 1,
          currentPage: 1,
        },
      });
    });
  });
});
