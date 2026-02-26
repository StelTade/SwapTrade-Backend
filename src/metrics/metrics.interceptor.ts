import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const startTime = process.hrtime.bigint();

    return next.handle().pipe(
      finalize(() => {
        const durationNs = process.hrtime.bigint() - startTime;
        const durationSeconds = Number(durationNs) / 1e9;
        const method = request?.method || 'UNKNOWN';
        const route = request?.route?.path || request?.path || 'UNKNOWN';
        const status = response?.statusCode || 500;

        this.metricsService.recordHttpRequest(method, route, status, durationSeconds);
      }),
    );
  }
}
