import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Import rate limiting middleware (will be available after npm install)
// import { rateLimitMiddleware } from './ratelimit/ratelimit.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
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
    .setDescription('API documentation for the SwapTrade application')
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
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
  
  // TODO: Add monitoring for rate limit violations
  /*
  setInterval(() => {
    const stats = rateLimitMiddleware.getStats();
    console.log('Rate Limit Stats:', stats);
  }, 30000); // Log every 30 seconds
  */
}
void bootstrap();