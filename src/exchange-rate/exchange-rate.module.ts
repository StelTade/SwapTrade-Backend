import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExchangeRateController } from './exchange-rate.controller';
import { ExchangeRateService } from './exchange-rate.service';
import { CustomCacheModule } from '../common/cache/cache.module';

@Module({
  imports: [
    ConfigModule,
    CustomCacheModule,
  ],
  controllers: [ExchangeRateController],
  providers: [ExchangeRateService],
  exports: [ExchangeRateService],
})
export class ExchangeRateModule {}
