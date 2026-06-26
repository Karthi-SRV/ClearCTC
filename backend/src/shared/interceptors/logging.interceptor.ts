import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';

const httpRequests = new Counter({
  name: 'clearctc_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const httpDuration = new Histogram({
  name: 'clearctc_http_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method: string; route?: { path: string }; url: string }>();
    const route = req.route?.path ?? req.url;
    const start = Date.now();
    const stopTimer = httpDuration.startTimer({ method: req.method, route });

    this.logger.log(`→ ${req.method} ${req.url}`);

    // Capture HTTP status from the exception before the exception filter runs,
    // because finalize fires before exception filters set res.statusCode.
    let errorStatus: number | undefined;

    return next.handle().pipe(
      tap({
        error: (err: unknown) => {
          errorStatus = err instanceof HttpException ? err.getStatus() : 500;
        },
      }),
      finalize(() => {
        const res = context.switchToHttp().getResponse<{ statusCode: number }>();
        const status = errorStatus ?? res.statusCode;
        const ms = Date.now() - start;

        httpRequests.inc({ method: req.method, route, status });
        stopTimer();

        const line = `← ${status} ${req.method} ${route} ${ms}ms`;
        if (status >= 500) {
          this.logger.error(line);
        } else if (status >= 400) {
          this.logger.warn(line);
        } else {
          this.logger.log(line);
        }
      }),
    );
  }
}
