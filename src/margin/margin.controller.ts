import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { MarginPairConfigService } from './services/margin-pair-config.service';
import { MarginPositionService } from './services/margin-position.service';
import { MarginInterestService } from './services/margin-interest.service';
import { MarginCalculatorService } from './services/margin-calculator.service';
import { CreateMarginPairConfigDto } from './dto/create-margin-pair-config.dto';
import { UpdateMarginPairConfigDto } from './dto/update-margin-pair-config.dto';
import { OpenMarginPositionDto } from './dto/open-margin-position.dto';

@Controller('margin')
export class MarginController {
  constructor(
    private readonly pairConfigService: MarginPairConfigService,
    private readonly positionService: MarginPositionService,
    private readonly interestService: MarginInterestService,
    private readonly calculator: MarginCalculatorService,
  ) {}

  @Post('pairs')
  createPairConfig(@Body() dto: CreateMarginPairConfigDto) {
    return this.pairConfigService.create(dto);
  }

  @Put('pairs/:id')
  updatePairConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMarginPairConfigDto,
  ) {
    return this.pairConfigService.update(id, dto);
  }

  @Get('pairs')
  listPairConfigs() {
    return this.pairConfigService.listAll();
  }

  @Get('pairs/:id')
  getPairConfig(@Param('id', ParseIntPipe) id: number) {
    return this.pairConfigService.getById(id);
  }

  @Get('pairs/:id/effective-leverage')
  async getEffectiveLeverage(@Param('id', ParseIntPipe) id: number) {
    const config = await this.pairConfigService.getById(id);
    return {
      pairConfigId: id,
      maxLeverage: Number(config.maxLeverage),
      effectiveMaxLeverage:
        this.calculator.calculateEffectiveMaxLeverage(config),
      volatilityPct: Number(config.volatilityPct),
    };
  }

  @Post('positions/open')
  openPosition(@Body() dto: OpenMarginPositionDto) {
    return this.positionService.openPosition(dto);
  }

  @Post('positions/:id/close')
  closePosition(
    @Param('id') id: string,
    @Body('currentPrice') currentPrice: number,
  ) {
    return this.positionService.closePosition(id, currentPrice);
  }

  @Get('positions/user/:userId')
  getUserPositions(@Param('userId', ParseIntPipe) userId: number) {
    return this.positionService.getUserPositions(userId);
  }

  @Get('positions/:id')
  getPosition(@Param('id') id: string) {
    return this.positionService.getPosition(id);
  }

  @Get('positions/:id/interest-history')
  getInterestHistory(@Param('id') id: string) {
    return this.interestService.getAccrualHistory(id);
  }
}
