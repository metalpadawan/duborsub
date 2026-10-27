import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MonitoringService } from '../../monitoring/monitoring.service';
import { sendErrorAlert } from '../alerts/alert-webhook';

type RequestWithContext = Request & {
  requestId?: string;
  user?: {
    id?: string;
  };
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly monitoring: MonitoringService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithContext>();
    const response = ctx.getResponse<Response>();
    const path = (request.originalUrl ?? request.url).split('?')[0];

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === 'object' && body && 'message' in body
          ? ((body as { message?: string | string[] }).message ?? exception.message)
          : exception.message;
    } else {
      this.logger.error(
        `Unhandled exception on ${request.method} ${path} (${request.requestId ?? 'no-request-id'})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      // Only the unexpected ones: errors the code raises on purpose (404, 403...) are not alerts.
      const name = exception instanceof Error ? `${exception.name}: ${exception.message}` : String(exception);
      sendErrorAlert(
        `${request.method} ${path} ${name}`,
        [`AniRate server error on ${request.method} ${path}`, name, `Request ${request.requestId ?? 'unknown'}`].join('\n'),
      );
    }

    if (status === HttpStatus.FORBIDDEN || status === HttpStatus.TOO_MANY_REQUESTS) {
      this.monitoring.recordSecurityEvent({
        type: status === HttpStatus.TOO_MANY_REQUESTS ? 'request.rate_limited' : 'request.forbidden',
        severity: status === HttpStatus.TOO_MANY_REQUESTS ? 'warning' : 'info',
        message:
          status === HttpStatus.TOO_MANY_REQUESTS
            ? 'A request was blocked by rate limiting'
            : 'A request was denied by authorization controls',
        userId: request.user?.id ?? null,
        ipAddress: request.ip ?? null,
        path,
        metadata: {
          method: request.method,
          statusCode: status,
        },
      });
    }

    response.status(status).json({
      statusCode: status,
      message,
      path,
      requestId: request.requestId ?? null,
      timestamp: new Date().toISOString(),
    });
  }
}
