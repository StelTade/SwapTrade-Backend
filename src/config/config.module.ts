import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EnvService, envSchema } from './env.service';
import { ConfigController } from './config.controller';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),
  ],
  controllers: [ConfigController],
  providers: [EnvService],
  exports: [EnvService],
})
export class ConfigModule {}
