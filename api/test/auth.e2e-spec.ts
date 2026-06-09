import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.ADMIN_EMAIL = 'admin@shop.com';
    process.env.ADMIN_PASSWORD = 'admin-password';

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
  }, 30_000);

  afterAll(() => app.close());

  describe('POST /auth/login', () => {
    it('returns 200 with accessToken for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@shop.com', password: 'admin-password' })
        .expect(200);
      expect(res.body).toMatchObject({ accessToken: expect.any(String) });
    });

    it('returns 401 for wrong password', () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@shop.com', password: 'wrong' })
        .expect(401));

    it('returns 401 for wrong email', () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'notadmin@shop.com', password: 'admin-password' })
        .expect(401));

    it('returns 400 for invalid email format', () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: 'admin-password' })
        .expect(400));
  });

  describe('GET /auth/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@shop.com', password: 'admin-password' });
      accessToken = res.body.accessToken;
    });

    it('returns 401 without token', () =>
      request(app.getHttpServer()).get('/auth/me').expect(401));

    it('returns 200 with userId and role for valid token', () =>
      request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({ userId: 'admin', role: 'admin' });
        }));
  });
});
