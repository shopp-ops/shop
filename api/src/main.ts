import './tracing';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { httpRequestDuration, httpRequestsTotal } from './metrics/http.metrics';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: true,
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3001',
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  // Without this, `new Logger()` calls (used throughout the app) go through Nest's
  // default ConsoleLogger instead of pino — plain text, not shipped to Loki as JSON.
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Record HTTP metrics at the Fastify onResponse hook — fires after the response is
  // fully sent, capturing the whole server lifecycle (guards, pipes, serialization,
  // send), unlike a Nest interceptor which only wraps the controller handler.
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onResponse', (req, reply, done) => {
    const route: string = req.routeOptions?.url ?? 'unmatched';
    if (!route.startsWith('/metrics')) {
      const status = reply.statusCode.toString();
      httpRequestDuration.labels(req.method, route, status).observe(reply.elapsedTime / 1000);
      httpRequestsTotal.labels(req.method, route, status).inc();
    }
    done();
  });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
