// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { QueueService } from './queue/queue.service';
import { QueueMonitoringService } from './queue/queue-monitoring.service';
import { validateMigrations } from './database/migrations/migration.guard';
import { AppDataSource } from './database/data-source';
import { ErrorLoggerService } from './common/logging/error-logger.service';

// Import rate limiting middleware (will be available after npm install)
// import { rateLimitMiddleware } from './ratelimit/ratelimit.middleware';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Get error logger service for global error handling
  const errorLoggerService = app.get(ErrorLoggerService);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: false, // Keep error messages for validation feedback
      errorHttpStatusCode: 400, // Set default error status code for validation errors
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // Enable CORS
  app.enableCors();

  // TODO: Uncomment and configure rate limiting middleware after installing dependencies
  /*
  app.use((req, res, next) => {
    // This is where rate limiting middleware will be applied
    // rateLimitMiddleware.use(req, res, next);
    next(); // Temporary bypass until dependencies are installed
  });
  */

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('SwapTrade API')
    .setDescription(`API documentation for the SwapTrade application.\n\n**Authentication:**\n- All endpoints (except /auth) require a Bearer JWT token.\n- Use the /auth/login endpoint to obtain a token.\n- Add the token using the "Authorize" button in Swagger UI.\n\n**Rate Limiting:**\n- Login: 5 attempts per 15 minutes per user.\n- Balance: 50 requests per minute.\n- See 429 responses for details.\n\n**Error Handling:**\n- Standardized error responses with codes and messages.\n- See error response examples for each endpoint.\n`)
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('swap', 'Token swap endpoints')
    .addTag('user', 'User management endpoints')
    .addTag('portfolio', 'Portfolio management endpoints')
    .addTag('trading', 'Trading endpoints')
    .addTag('rewards', 'Rewards and badges endpoints')
    .addTag('notification', 'Notification endpoints')
    .addTag('bidding', 'Bidding endpoints')
    .addTag('balance', 'Balance management endpoints')
    .addTag('queue', 'Background job queue management')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      docExpansion: 'list',
      persistAuthorization: true,
    },
    customSiteTitle: 'SwapTrade API Docs',
  });

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Setup graceful shutdown handlers
  const queueService = app.get(QueueService);
  let isShuttingDown = false;

  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn('Shutdown already in progress...');
      return;
    }

    isShuttingDown = true;
    logger.log(`Received ${signal}, starting graceful shutdown...`);

    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();

    try {
      logger.log('Stopping server from accepting new connections...');

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Shutdown timeout exceeded'));
        }, shutdownTimeout);
      });

      const shutdownPromise = (async () => {
        logger.log('Waiting for in-flight requests to complete...');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        logger.log('Closing queue connections and waiting for active jobs...');
        await queueService.closeAllQueues();

        logger.log('Closing database connections...');
        await app.close();

        const elapsed = Date.now() - startTime;
        logger.log(`Graceful shutdown completed in ${elapsed}ms`);
      })();

      await Promise.race([shutdownPromise, timeoutPromise]);
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      logger.error('Forcing shutdown...');
      process.exit(1);
    }
  };

  // Register signal handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Setup global error handlers for unhandled rejections and uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    if (errorLoggerService) {
      errorLoggerService.logUncaughtException(error);
    }
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    if (errorLoggerService) {
      errorLoggerService.logUnhandledRejection(reason, promise);
    }
    gracefulShutdown('unhandledRejection');
  });

  // Verify queue connectivity before accepting traffic
  const queueMonitoringService = app.get(QueueMonitoringService);
  try {
    await queueMonitoringService.verifyConnections();
  } catch (err) {
    logger.error('Queue connectivity check failed, aborting startup', err);
    process.exit(1);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation: http://localhost:${port}/api`);
  logger.log('Graceful shutdown handlers registered');
  logger.log(`Shutdown timeout: ${30000}ms`);
  logger.log('Global error handlers registered for uncaught exceptions and unhandled rejections');

  await validateMigrations(AppDataSource);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
