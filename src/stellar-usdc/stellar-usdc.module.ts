import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StellarUsdcController } from './stellar-usdc.controller';
import { StellarUsdcService } from './stellar-usdc.service';

@Module({
  imports: [ConfigModule],
  controllers: [StellarUsdcController],
  providers: [StellarUsdcService],
  exports: [StellarUsdcService],
})
export class StellarUsdcModule {}
