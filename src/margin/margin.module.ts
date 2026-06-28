import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarginPairConfig } from './entities/margin-pair-config.entity';
import { MarginPosition } from './entities/margin-position.entity';
import { MarginInterestAccrual } from './entities/margin-interest-accrual.entity';
import { MarginCalculatorService } from './services/margin-calculator.service';
import { MarginPairConfigService } from './services/margin-pair-config.service';
import { MarginPositionService } from './services/margin-position.service';
import { LiquidationEngineService } from './services/liquidation-engine.service';
import { MarginInterestService } from './services/margin-interest.service';
import { MarginController } from './margin.controller';
import { MarginListener } from './listeners/margin.listener';
import { UserBalance } from '../database/entities/user-balance.entity';
import { VirtualAsset } from '../database/entities/virtual-asset.entity';
import { Auth } from '../auth/entities/auth.entity';
import { User } from '../user/entities/user.entity';
import { ProtectionModule } from '../protection/protection.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarginPairConfig,
      MarginPosition,
      MarginInterestAccrual,
      UserBalance,
      VirtualAsset,
      Auth,
      User,
    ]),
    ProtectionModule,
    QueueModule,
  ],
  controllers: [MarginController],
  providers: [
    MarginCalculatorService,
    MarginPairConfigService,
    MarginPositionService,
    LiquidationEngineService,
    MarginInterestService,
    MarginListener,
  ],
  exports: [
    MarginCalculatorService,
    MarginPairConfigService,
    MarginPositionService,
    LiquidationEngineService,
    MarginInterestService,
  ],
})
export class MarginModule {}
