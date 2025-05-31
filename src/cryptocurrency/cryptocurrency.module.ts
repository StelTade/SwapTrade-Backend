import { Module } from '@nestjs/common';
import { CryptocurrencyService } from './cryptocurrency.service';
import { CryptocurrencyController } from './cryptocurrency.controller';

@Module({
  controllers: [CryptocurrencyController],
  providers: [CryptocurrencyService],
})
export class CryptocurrencyModule {}
