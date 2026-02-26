import { INestApplication } from '@nestjs/common';

export function configureApiVersioning(app: INestApplication) {
  app.setGlobalPrefix('api/v1');
}

