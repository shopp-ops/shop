import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { httpRequestDuration, httpRequestsTotal } from './http.metrics';
import { Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {

  constructor(
    private readonly reflector: Reflector,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {

    const start = Date.now();

    const controller = context.getClass();
    const handler = context.getHandler();

    const controllerPath =
      this.reflector.get<string>(
        PATH_METADATA,
        controller,
      ) ?? '';

    const handlerPath =
      this.reflector.get<string>(
        PATH_METADATA,
        handler,
      ) ?? '';

    const route = `/${controllerPath}/${handlerPath}`.replace(/\/+/g, '/');

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    //const route = context.getHandler().name;

    return next.handle().pipe(
      tap(() => {
        const status = response.statusCode.toString();
        httpRequestDuration
          .labels(
            request.method,
            route,
            status,
          )
          .observe((Date.now() - start) / 1000);
        httpRequestsTotal
          .labels(
            request.method,
            route,
            status,
          )
          .inc();
      }),
    );
  }
}