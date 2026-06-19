import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { OrderStatus } from './entities/order.entity';
import {
  OrderRecord,
  OrdersRepository,
} from './repositories/orders.repository';
import { OrdersService } from './orders.service';

const makeOrder = (overrides: Partial<OrderRecord> = {}): OrderRecord => ({
  id: '11111111-1111-1111-1111-111111111111',
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
  items: [
    {
      id: '22222222-2222-2222-2222-222222222222',
      productId: '33333333-3333-3333-3333-333333333333',
      productName: 'Widget',
      quantity: 2,
      unitPrice: 50,
    },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('OrdersService', () => {
  let service: OrdersService;
  let ordersRepository: jest.Mocked<OrdersRepository>;

  beforeEach(async () => {
    ordersRepository = {
      create: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      restoreStockAndSetStatus: jest.fn(),
      findStalePending: jest.fn(),
      findAll: jest.fn(),
      insert: jest.fn(),
      clear: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: OrdersRepository,
          useValue: ordersRepository,
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
      items: [
        {
          productId: '33333333-3333-3333-3333-333333333333',
          quantity: 2,
        },
      ],
    };

    it('creates an order via the active repository', async () => {
      ordersRepository.create.mockResolvedValue({
        orderId: '11111111-1111-1111-1111-111111111111',
        totalAmount: '0.05',
      });
      jest
        .spyOn(
          service as unknown as { getEthUsdRate: () => Promise<number> },
          'getEthUsdRate',
        )
        .mockResolvedValue(2000);

      const result = await service.create(dto);

      expect(ordersRepository.create).toHaveBeenCalledWith(dto, 2000);
      expect(result).toEqual({
        orderId: '11111111-1111-1111-1111-111111111111',
        totalAmount: '0.05',
        shopWalletAddress: '0xSHOP_WALLET',
      });
    });

    it('propagates repository errors during creation', async () => {
      ordersRepository.create.mockRejectedValue(
        new ConflictException('Insufficient stock for "Widget"'),
      );
      jest
        .spyOn(
          service as unknown as { getEthUsdRate: () => Promise<number> },
          'getEthUsdRate',
        )
        .mockResolvedValue(2000);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyPayment', () => {
    const dto: VerifyPaymentDto = { txHash: '0x' + 'a'.repeat(64) };

    it('confirms order when tx is valid', async () => {
      ordersRepository.findOne.mockResolvedValue(makeOrder());
      ordersRepository.save.mockImplementation((order) =>
        Promise.resolve(order),
      );

      jest.spyOn(service['viemClient'], 'getTransaction').mockResolvedValue({
        to: '0xSHOP_WALLET',
        value: BigInt('50000000000000000'),
      } as never);
      jest
        .spyOn(service['viemClient'], 'getTransactionReceipt')
        .mockResolvedValue({
          status: 'success',
        } as never);

      const result = await service.verifyPayment(
        '11111111-1111-1111-1111-111111111111',
        dto,
      );

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(result.txHash).toBe(dto.txHash);
      expect(ordersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: OrderStatus.CONFIRMED,
          txHash: dto.txHash,
        }),
      );
    });

    it('marks order as failed and throws when recipient is wrong', async () => {
      ordersRepository.findOne.mockResolvedValue(makeOrder());
      ordersRepository.save.mockImplementation((order) =>
        Promise.resolve(order),
      );

      jest.spyOn(service['viemClient'], 'getTransaction').mockResolvedValue({
        to: '0xWRONG',
        value: BigInt('50000000000000000'),
      } as never);
      jest
        .spyOn(service['viemClient'], 'getTransactionReceipt')
        .mockResolvedValue({
          status: 'success',
        } as never);

      await expect(
        service.verifyPayment('11111111-1111-1111-1111-111111111111', dto),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(ordersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: OrderStatus.FAILED,
          txHash: dto.txHash,
        }),
      );
    });

    it('marks order as failed and throws when value is insufficient', async () => {
      ordersRepository.findOne.mockResolvedValue(makeOrder());
      ordersRepository.save.mockImplementation((order) =>
        Promise.resolve(order),
      );

      jest.spyOn(service['viemClient'], 'getTransaction').mockResolvedValue({
        to: '0xSHOP_WALLET',
        value: BigInt('1'),
      } as never);
      jest
        .spyOn(service['viemClient'], 'getTransactionReceipt')
        .mockResolvedValue({
          status: 'success',
        } as never);

      await expect(
        service.verifyPayment('11111111-1111-1111-1111-111111111111', dto),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws NotFoundException when order does not exist', async () => {
      ordersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyPayment('11111111-1111-1111-1111-111111111111', dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('restores stock and sets status to CANCELLED', async () => {
      const order = makeOrder();
      const cancelled = makeOrder({ status: OrderStatus.CANCELLED });
      ordersRepository.findOne.mockResolvedValue(order);
      ordersRepository.restoreStockAndSetStatus.mockResolvedValue(cancelled);

      const result = await service.cancel(
        '11111111-1111-1111-1111-111111111111',
      );

      expect(ordersRepository.restoreStockAndSetStatus).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        OrderStatus.CANCELLED,
      );
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('throws NotFoundException when order does not exist', async () => {
      ordersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.cancel('11111111-1111-1111-1111-111111111111'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when order is not pending', async () => {
      ordersRepository.findOne.mockResolvedValue(
        makeOrder({ status: OrderStatus.CONFIRMED }),
      );

      await expect(
        service.cancel('11111111-1111-1111-1111-111111111111'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('expireStaleOrders', () => {
    it('expires stale pending orders', async () => {
      const order = makeOrder();
      ordersRepository.findStalePending.mockResolvedValue([order]);
      ordersRepository.restoreStockAndSetStatus.mockResolvedValue(
        makeOrder({ status: OrderStatus.EXPIRED }),
      );

      await service.expireStaleOrders();

      expect(ordersRepository.findStalePending).toHaveBeenCalledWith(
        expect.any(Date),
      );
      expect(ordersRepository.restoreStockAndSetStatus).toHaveBeenCalledWith(
        order.id,
        OrderStatus.EXPIRED,
      );
    });

    it('does nothing when no stale orders exist', async () => {
      ordersRepository.findStalePending.mockResolvedValue([]);

      await service.expireStaleOrders();

      expect(ordersRepository.restoreStockAndSetStatus).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns paginated orders from repository', async () => {
      const response = {
        data: [
          makeOrder(),
          makeOrder({ id: '44444444-4444-4444-4444-444444444444' }),
        ],
        meta: {
          totalItems: 2,
          itemCount: 2,
          itemsPerPage: 20,
          totalPages: 1,
          currentPage: 1,
        },
      };
      ordersRepository.findAll.mockResolvedValue(response);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(ordersRepository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
      });
      expect(result).toEqual(response);
    });
  });
});
