import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
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
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();