import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as cors from 'cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Helmet for HTTP header security
  app.use(helmet());

  // CORS configuration
  app.enableCors({
    origin: [process.env.CORS_ORIGIN || '*'], // Set to your frontend domain in production
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
