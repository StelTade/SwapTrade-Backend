import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerService } from './logger_service';
import { AuditService } from './audit_service';
import { MetricsService } from './metrics_service';
import { LoggingMiddleware } from '../middleware/logging_middleware';
import { LoggingInterceptor } from '../interceptors/logging_interceptor';

@Global()
@Module({
  providers: [
    LoggerService,
    AuditService,
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  exports: [LoggerService, AuditService, MetricsService],
})
export class LoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}