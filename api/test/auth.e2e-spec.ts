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

describe('Auth (e2e)', () => {
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

  it('GET /auth/me returns 401 without a token', () =>
    request(app.getHttpServer()).get('/auth/me').expect(401));

  // Runs last: the bootstrapped admin starts with mustChangePassword=true and
  // this flow mutates the shared password, so ordering matters.
  describe('first-login password change flow', () => {
    let accessToken: string;
    const newPassword = 'new-admin-password';

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@shop.com', password: 'admin-password' });
      accessToken = res.body.accessToken;
    });

    it('blocks protected routes with 403 while a password change is required', () =>
      request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403));

    it('rejects a password change with the wrong current password (401)', () =>
      request(app.getHttpServer())
        .patch('/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'wrong', newPassword })
        .expect(401));

    it('changes the password (204)', () =>
      request(app.getHttpServer())
        .patch('/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'admin-password', newPassword })
        .expect(204));

    it('rejects the old password after the change (401)', () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@shop.com', password: 'admin-password' })
        .expect(401));

    it('logs in with the new password and can access protected routes', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@shop.com', password: newPassword })
        .expect(200);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({
            userId: expect.any(String),
            role: 'admin',
            mustChangePassword: false,
          });
        });
    });
  });
});
