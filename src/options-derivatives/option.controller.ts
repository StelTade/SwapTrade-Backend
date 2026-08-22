import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { OptionContractService } from './services/option-contract.service';
import { OptionExerciseService } from './services/option-exercise.service';
import { OptionCollateralService } from './services/option-collateral.service';
import { OptionPositionService } from './services/option-position.service';
import { VolatilitySurfaceService } from './services/volatility-surface.service';
import { BlackScholesService } from './services/black-scholes.service';
import { CreateOptionContractDto } from './dto/create-option-contract.dto';
import { ExerciseOptionDto } from './dto/exercise-option.dto';
import { BuyOptionDto } from './dto/buy-option.dto';
import { UpdateVolatilityDto } from './dto/update-volatility.dto';
import { OptionType } from './enums/option-type.enum';
import { OptionStatus } from './enums/option-status.enum';

@Controller('options')
export class OptionController {
  constructor(
    private readonly contractService: OptionContractService,
    private readonly exerciseService: OptionExerciseService,
    private readonly collateralService: OptionCollateralService,
    private readonly positionService: OptionPositionService,
    private readonly volatilityService: VolatilitySurfaceService,
    private readonly blackScholes: BlackScholesService,
  ) {}

  // ── Contract Endpoints ──

  @Post('contracts')
  createContract(@Body() dto: CreateOptionContractDto) {
    return this.contractService.createContract(dto);
  }

  @Get('contracts')
  listContracts(
    @Query('underlyingAssetId') underlyingAssetId?: string,
    @Query('optionType') optionType?: OptionType,
    @Query('status') status?: OptionStatus,
  ) {
    return this.contractService.listContracts({
      underlyingAssetId: underlyingAssetId
        ? parseInt(underlyingAssetId, 10)
        : undefined,
      optionType,
      status,
    });
  }

  @Get('contracts/:id')
  getContract(@Param('id', ParseIntPipe) id: number) {
    return this.contractService.getContract(id);
  }

  @Post('contracts/:id/recalculate')
  recalculatePrice(
    @Param('id', ParseIntPipe) id: number,
    @Body('currentPrice') currentPrice: number,
  ) {
    return this.contractService.recalculatePrice(id, currentPrice);
  }

  // ── Pricing Endpoint ──

  @Post('pricing/black-scholes')
  calculateBlackScholes(
    @Body()
    body: {
      spotPrice: number;
      strikePrice: number;
      timeToExpiry: number;
      riskFreeRate: number;
      volatility: number;
      optionType: OptionType;
    },
  ) {
    return this.blackScholes.calculate(
      body.spotPrice,
      body.strikePrice,
      body.timeToExpiry,
      body.riskFreeRate,
      body.volatility,
      body.optionType,
    );
  }

  // ── Position Endpoints ──

  @Post('positions/buy')
  buyOption(@Body() dto: BuyOptionDto) {
    return this.positionService.buyOption(dto);
  }

  @Get('positions/user/:userId')
  getUserPositions(@Param('userId', ParseIntPipe) userId: number) {
    return this.positionService.getUserPositions(userId);
  }

  @Get('positions/user/:userId/portfolio')
  getUserPortfolio(@Param('userId', ParseIntPipe) userId: number) {
    return this.positionService.getUserPortfolioSummary(userId);
  }

  @Get('positions/:id')
  getPosition(@Param('id', ParseIntPipe) id: number) {
    return this.positionService.getPosition(id);
  }

  @Post('positions/:id/update-pnl')
  updateUnrealizedPnl(
    @Param('id', ParseIntPipe) id: number,
    @Body('currentPrice') currentPrice: number,
  ) {
    return this.positionService.updateUnrealizedPnl(id, currentPrice);
  }

  // ── Exercise Endpoint ──

  @Post('exercise')
  exerciseOption(@Body() dto: ExerciseOptionDto) {
    return this.exerciseService.exerciseOption(dto);
  }

  @Post('expire-contracts')
  expireContracts() {
    return this.exerciseService.expireContracts();
  }

  // ── Collateral Endpoints ──

  @Post('collateral/lock')
  lockCollateral(
    @Body()
    body: {
      userId: number;
      contractId: number;
      quantity: number;
      collateralAssetId: number;
    },
  ) {
    return this.collateralService.lockCollateral(
      body.userId,
      body.contractId,
      body.quantity,
      body.collateralAssetId,
    );
  }

  @Post('collateral/release')
  releaseCollateral(
    @Body()
    body: {
      userId: number;
      contractId: number;
      quantity: number;
    },
  ) {
    return this.collateralService.releaseCollateral(
      body.userId,
      body.contractId,
      body.quantity,
    );
  }

  @Get('collateral/user/:userId')
  getUserCollateral(@Param('userId', ParseIntPipe) userId: number) {
    return this.collateralService.getUserCollateral(userId);
  }

  @Get('collateral/contract/:contractId')
  getContractCollateral(
    @Param('contractId', ParseIntPipe) contractId: number,
  ) {
    return this.collateralService.getContractCollateral(contractId);
  }

  @Get('collateral/contract/:contractId/validation')
  validateCollateralCoverage(
    @Param('contractId', ParseIntPipe) contractId: number,
  ) {
    return this.collateralService.validateCollateralCoverage(contractId);
  }

  // ── Volatility Surface Endpoints ──

  @Post('volatility/update')
  updateVolatility(@Body() dto: UpdateVolatilityDto) {
    return this.volatilityService.updateVolatility({
      ...dto,
      expirationDate: new Date(dto.expirationDate),
    });
  }

  @Get('volatility/surface/:assetId')
  getVolatilitySurface(
    @Param('assetId', ParseIntPipe) assetId: number,
  ) {
    return this.volatilityService.getVolatilitySurface(assetId);
  }

  @Get('volatility/interpolate')
  async getInterpolatedVolatility(
    @Query('assetId', ParseIntPipe) assetId: number,
    @Query('strikePrice') strikePrice: string,
    @Query('expirationDate') expirationDate: string,
  ) {
    const iv = await this.volatilityService.getInterpolatedVolatility(
      assetId,
      parseFloat(strikePrice),
      new Date(expirationDate),
    );
    return { impliedVolatility: iv };
  }

  @Get('volatility/term-structure')
  getTermStructure(
    @Query('assetId', ParseIntPipe) assetId: number,
    @Query('strikePrice') strikePrice: string,
  ) {
    return this.volatilityService.getTermStructure(
      assetId,
      parseFloat(strikePrice),
    );
  }

  @Get('volatility/skew')
  getSkew(
    @Query('assetId', ParseIntPipe) assetId: number,
    @Query('expirationDate') expirationDate: string,
  ) {
    return this.volatilityService.getSkew(assetId, new Date(expirationDate));
  }
}
