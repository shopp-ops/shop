import { INestApplication, ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Products (e2e)', () => {
  let app: INestApplication<App>;
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16').start();
    process.env.DATABASE_URL = container.getConnectionUri();
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.ADMIN_EMAIL = 'admin@shop.com';
    process.env.ADMIN_PASSWORD = 'admin-password';
    process.env.NODE_ENV = 'test';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    await (
      app.getHttpAdapter().getInstance() as { ready(): Promise<void> }
    ).ready();
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await container.stop();
  }, 60_000);

  describe('POST /products', () => {
    it('creates a product and defaults quantity to 0', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Keyboard', price: 99.99 })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'Keyboard',
        quantity: 0,
      });
      expect(Number(res.body.price)).toBeCloseTo(99.99);
    });

    it('returns 400 for missing name', () =>
      request(app.getHttpServer())
        .post('/products')
        .send({ price: 49.99 })
        .expect(400));

    it('returns 400 for negative quantity', () =>
      request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Mouse', quantity: -1, price: 49.99 })
        .expect(400));

    it('returns 400 for non-positive price', () =>
      request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Mouse', quantity: 1, price: 0 })
        .expect(400));
  });

  describe('GET /products', () => {
    it('returns all products', async () => {
      const created = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Monitor', quantity: 3, price: 199.99 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: created.body.id,
            name: 'Monitor',
            quantity: 3,
          }),
        ]),
      );
    });
  });

  describe('GET /products/:id', () => {
    it('returns a product by id', async () => {
      const created = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Chair', quantity: 2, price: 59.99 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/products/${created.body.id}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: created.body.id,
        name: 'Chair',
        quantity: 2,
      });
      expect(Number(res.body.price)).toBeCloseTo(59.99);
    });

    it('returns 400 for invalid uuid', () =>
      request(app.getHttpServer()).get('/products/not-a-uuid').expect(400));
  });

  describe('PATCH /products/:id', () => {
    it('updates an existing product', async () => {
      const created = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Desk', quantity: 1, price: 149.99 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/products/${created.body.id}`)
        .send({ name: 'Standing desk', quantity: 4, price: 249.99 })
        .expect(200);

      expect(res.body).toMatchObject({
        id: created.body.id,
        name: 'Standing desk',
        quantity: 4,
      });
      expect(Number(res.body.price)).toBeCloseTo(249.99);
    });

    it('returns 404 when updating a missing product', () =>
      request(app.getHttpServer())
        .patch('/products/11111111-1111-1111-1111-111111111111')
        .send({ name: 'Missing desk' })
        .expect(404));
  });

  describe('DELETE /products/:id', () => {
    it('deletes an existing product', async () => {
      const created = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Lamp', quantity: 5, price: 19.99 })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/products/${created.body.id}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/products/${created.body.id}`)
        .expect(404);
    });

    it('returns 404 when deleting a missing product', () =>
      request(app.getHttpServer())
        .delete('/products/11111111-1111-1111-1111-111111111111')
        .expect(404));
  });
});
