// src/common/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoggerService } from '../logging/logger_service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const startTime = Date.now();
    const handler = context.getHandler().name;
    const controller = context.getClass().name;

    // Log method entry
    this.logger.debug(`Entering ${controller}.${handler}`, {
      method,
      url,
      controller,
      handler,
    });

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        
        // Log successful execution
        this.logger.debug(`Completed ${controller}.${handler}`, {
          method,
          url,
          controller,
          handler,
          duration,
          responseType: data?.constructor?.name,
        });

        // Log performance metric for handler
        this.logger.metric('handler.duration', duration, {
          controller,
          handler,
          method,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        // Determine error details
        const status = error instanceof HttpException 
          ? error.getStatus() 
          : HttpStatus.INTERNAL_SERVER_ERROR;
        
        const errorResponse = error instanceof HttpException
          ? error.getResponse()
          : { message: error.message };

        // Log error with full context
        this.logger.error(
          `Error in ${controller}.${handler}`,
          error.stack,
          {
            method,
            url,
            controller,
            handler,
            duration,
            statusCode: status,
            error: errorResponse,
            errorName: error.name,
          },
        );

        // Log error metric
        this.logger.metric('handler.error', 1, {
          controller,
          handler,
          method,
          statusCode: status.toString(),
          errorType: error.name,
        });

        return throwError(() => error);
      }),
    );
  }
}