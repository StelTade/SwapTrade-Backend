import { Body, Controller, Post, UseGuards, ValidationPipe, Req } from '@nestjs/common';
import { TradingService } from '../trading/trading.service';
import { MetricsService } from '../metrics/metrics.service';
import { CreateTradeDto } from '../trading/dto/create-trade.dto';
import { ApiKeyGuard } from '../common/security/api-key.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('bot-trading')
@Controller('bot/trading')
@UseGuards(ApiKeyGuard)
export class BotTradingController {
  constructor(
    private readonly tradingService: TradingService,
    private readonly metricsService: MetricsService,
  ) {}

  @Post('swap')
  @ApiOperation({ summary: 'Execute a trade as a bot (API key required)' })
  @ApiResponse({ status: 201, description: 'Trade executed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid trade parameters' })
  @ApiBody({ type: CreateTradeDto })
  async swap(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) body: CreateTradeDto,
    @Req() req
  ) {
    if (!req.isBot) {
      return { error: 'Only bot API keys can access this endpoint.' };
    }
    // Optionally check permissions here
    const result = await this.tradingService.swap(req.apiKeyOwnerId, body.asset, body.amount, body.price, body.type);
    this.metricsService.recordBotTrade(req.apiKeyOwnerId, body.asset, body.type);
    return result;
  }
}
