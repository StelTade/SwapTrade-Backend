// src/config/config.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigService } from './config.service';
import { configSchema } from './config.schema';
import { ConfigDocumentationGenerator } from './config-documentation.generator';
import { ConfigAuditService } from './config-audit.service';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: configSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
  ],
  providers: [ConfigService, ConfigDocumentationGenerator, ConfigAuditService],
  exports: [ConfigService, ConfigDocumentationGenerator, ConfigAuditService],
})
export class ConfigModule {}