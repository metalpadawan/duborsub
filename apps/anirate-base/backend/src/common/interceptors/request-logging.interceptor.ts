import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MonitoringService } from '../../monitoring/monitoring.service';

type RequestWithContext = Request & {
  requestId?: string;
  user?: {
    id?: string;
  };
};

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  constructor(private readonly monitoring: MonitoringService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();
    const requestId = this.resolveRequestId(request);
    const path = (request.originalUrl ?? request.url).split('?')[0];

    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordRequest(request, response, path, Date.now() - startedAt, response.statusCode);
        },
        error: (error) => {
          const statusCode =
            typeof error?.getStatus === 'function' ? Number(error.getStatus()) : 500;
          this.recordRequest(request, response, path, Date.now() - startedAt, statusCode);
        },
      }),
    );
  }

  private recordRequest(
    request: RequestWithContext,
    response: Response,
    path: string,
    durationMs: number,
    statusCode: number,
  ) {
    this.monitoring.trackRequest({
      method: request.method,
      path,
      statusCode,
      durationMs,
    });

    const userLabel = request.user?.id ? `user=${request.user.id}` : 'user=anonymous';
    const message = `${request.method} ${path} ${statusCode} ${durationMs}ms ${userLabel} requestId=${request.requestId}`;

    if (statusCode >= 500) {
      this.logger.error(message);
      return;
    }

    if (statusCode >= 400) {
      this.logger.warn(message);
      return;
    }

    this.logger.log(message);
  }

  private resolveRequestId(request: RequestWithContext) {
    const headerValue = request.headers['x-request-id'];
    if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
      return headerValue.trim();
    }

    if (Array.isArray(headerValue) && headerValue[0]?.trim()) {
      return headerValue[0].trim();
    }

    return randomUUID();
  }
}
