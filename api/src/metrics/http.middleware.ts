import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { httpRequestDuration, httpRequestsTotal } from './http.metrics';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use( req: FastifyRequest, res: FastifyReply, next: () => void, ) {
    const start = Date.now();

    res.raw.on('finish', () => {
      const route = req.routeOptions?.url ?? 'unknown';
      const status = res.statusCode.toString();
      httpRequestDuration
        .labels(
          req.method,
          route,
          status,
        )
        .observe((Date.now() - start) / 1000);
      httpRequestsTotal
        .labels(
          req.method,
          route,
          status,
        )
        .inc();
    });

    next();
  }
}