import {
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';
import { ExchangeRateResponseDto } from './dto/exchange-rate.dto';

@Controller('exchange-rate')
export class ExchangeRateController {
  private readonly logger = new Logger(ExchangeRateController.name);

  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  /**
   * Get current USD exchange rates
   * GET /api/exchange-rate
   * 
   * Returns all available exchange rates for USD base currency
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getRates(): Promise<ExchangeRateResponseDto> {
    return this.exchangeRateService.getRates();
  }

  /**
   * Get specific currency rate
   * GET /api/exchange-rate/:currency
   * 
   * Query params:
   * - currency: Currency code (e.g., EUR, GBP, JPY)
   */
  @Get('rate')
  @HttpCode(HttpStatus.OK)
  async getRate(
    @Query('currency') currency: string,
  ): Promise<{ currency: string; rate: number | null; base: string }> {
    if (!currency) {
      return { currency: '', rate: null, base: 'USD' };
    }
    
    const rate = await this.exchangeRateService.getRate(currency);
    return { currency: currency.toUpperCase(), rate, base: 'USD' };
  }

  /**
   * Force refresh exchange rates
   * GET /api/exchange-rate/refresh
   * 
   * Forces a cache clear and fetches fresh rates
   */
  @Get('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(): Promise<ExchangeRateResponseDto> {
    this.logger.log('Exchange rate refresh requested');
    return this.exchangeRateService.refresh();
  }

  /**
   * Get service health status
   * GET /api/exchange-rate/health
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastUpdate: Date | null;
    lastError: string | null;
    source: string;
  }> {
    return this.exchangeRateService.getHealth();
  }
}
