// src/common/logging/logging.module.ts
import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerService } from './logger.service';
import { AuditService } from './audit.service';
import { MetricsService } from './metrics.service';
import { LoggingMiddleware } from '../middleware/logging.middleware';
import { LoggingInterceptor } from '../interceptors/logging.interceptor';

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


// src/main.ts - Example integration
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from './common/logging/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use custom logger
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  await app.listen(3000);
  logger.log('Application started on port 3000');
}

bootstrap();


// src/app.module.ts - Example app module
import { Module } from '@nestjs/common';
import { LoggingModule } from './common/logging/logging.module';
import { MetricsController } from './common/logging/metrics.controller';

@Module({
  imports: [
    LoggingModule,
    // ... other modules
  ],
  controllers: [MetricsController],
})
export class AppModule {}