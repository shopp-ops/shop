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
  let authToken: string;

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

    // Dobavi JWT token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@shop.com',
        password: 'admin-password',
      });
    authToken = loginRes.body.accessToken;
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await container.stop();
  }, 60_000);

  describe('POST /api/products', () => {
    it('creates a product and defaults quantity to 0', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
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
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ price: 49.99 })
        .expect(400));

    it('returns 400 for negative quantity', () =>
      request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Mouse', quantity: -1, price: 49.99 })
        .expect(400));

    it('returns 400 for non-positive price', () =>
      request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Mouse', quantity: 1, price: 0 })
        .expect(400));
  });

  describe('GET /api/products', () => {
    it('returns paginated products', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Monitor',
          quantity: 3,
          price: 199.99,
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/products')
        .expect(200);

      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: created.body.id,
            name: 'Monitor',
            quantity: 3,
          }),
        ]),
      );

      expect(res.body.meta).toMatchObject({
        totalItems: expect.any(Number),
        itemCount: expect.any(Number),
        itemsPerPage: 20,
        currentPage: 1,
      });
    });
  });

  describe('GET /api/products?search=', () => {
    it('filters products by name', async () => {
      await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'UniqueMon_XYZ',
          quantity: 3,
          price: 199.99,
        });

      await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Keyboard_XYZ',
          quantity: 5,
          price: 49.99,
        });

      const res = await request(app.getHttpServer())
        .get('/api/products?search=UniqueMon_XYZ')
        .expect(200);

      expect(res.body.data).toHaveLength(1);

      expect(res.body.data[0]).toMatchObject({
        name: 'UniqueMon_XYZ',
      });
    });
  });

  describe('GET /api/products?page=&limit=', () => {
    it('supports pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products?page=1&limit=1')
        .expect(200);

      expect(res.body.meta.itemsPerPage).toBe(1);
      expect(res.body.meta.currentPage).toBe(1);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/products/:id', () => {
    it('returns a product by id', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Chair', quantity: 2, price: 59.99 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/products/${created.body.id}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: created.body.id,
        name: 'Chair',
        quantity: 2,
      });
      expect(Number(res.body.price)).toBeCloseTo(59.99);
    });

    it('returns 400 for invalid uuid', () =>
      request(app.getHttpServer()).get('/api/products/not-a-uuid').expect(400));
  });

  describe('PATCH /api/products/:id', () => {
    it('updates an existing product', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Desk', quantity: 1, price: 149.99 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/api/products/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
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
        .patch('/api/products/11111111-1111-1111-1111-111111111111')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Missing desk' })
        .expect(404));
  });

  describe('DELETE /api/products/:id', () => {
    it('deletes an existing product', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Lamp', quantity: 5, price: 19.99 })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/products/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/products/${created.body.id}`)
        .expect(404);
    });

    it('returns 404 when deleting a missing product', () =>
      request(app.getHttpServer())
        .delete('/api/products/11111111-1111-1111-1111-111111111111')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404));
  });
});
