import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StellarService } from './stellar.service';
import { StellarController } from './stellar.controller';

@Module({
  imports: [ConfigModule],
  providers: [StellarService],
  controllers: [StellarController],
  exports: [StellarService],
})
export class StellarModule {}
