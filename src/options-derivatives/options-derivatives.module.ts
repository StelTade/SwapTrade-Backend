import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OptionContract } from './entities/option-contract.entity';
import { OptionPosition } from './entities/option-position.entity';
import { OptionCollateral } from './entities/option-collateral.entity';
import { VolatilitySurface } from './entities/volatility-surface.entity';
import { VirtualAsset } from '../database/entities/virtual-asset.entity';
import { UserBalance } from '../database/entities/user-balance.entity';
import { BlackScholesService } from './services/black-scholes.service';
import { OptionContractService } from './services/option-contract.service';
import { OptionExerciseService } from './services/option-exercise.service';
import { OptionCollateralService } from './services/option-collateral.service';
import { OptionPositionService } from './services/option-position.service';
import { VolatilitySurfaceService } from './services/volatility-surface.service';
import { OptionController } from './option.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OptionContract,
      OptionPosition,
      OptionCollateral,
      VolatilitySurface,
      VirtualAsset,
      UserBalance,
    ]),
  ],
  controllers: [OptionController],
  providers: [
    BlackScholesService,
    OptionContractService,
    OptionExerciseService,
    OptionCollateralService,
    OptionPositionService,
    VolatilitySurfaceService,
  ],
  exports: [
    BlackScholesService,
    OptionContractService,
    OptionExerciseService,
    OptionCollateralService,
    OptionPositionService,
    VolatilitySurfaceService,
  ],
})
export class OptionsDerivativesModule {}
