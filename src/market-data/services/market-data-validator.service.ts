import { Injectable, Logger } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { MarketDataDto } from '../dto/market-data.dto';

@Injectable()
export class MarketDataValidatorService {
  private readonly logger = new Logger(MarketDataValidatorService.name);

  async validateMarketData(data: any): Promise<{ isValid: boolean; sanitizedData?: MarketDataDto; errors?: string[] }> {
    try {
      const sanitizedData = this.sanitizeData(data);
      const dataDto = plainToClass(MarketDataDto, sanitizedData);
      
      const validationErrors = await validate(dataDto);
      
      if (validationErrors.length > 0) {
        const errors = validationErrors.map(error => Object.values(error.constraints || {})).flat();
        this.logger.warn(`Market data validation failed: ${errors.join(', ')}`);
        return { isValid: false, errors };
      }

      return { isValid: true, sanitizedData: dataDto };
    } catch (error) {
      this.logger.error('Error during market data validation:', error);
      return { isValid: false, errors: ['Validation error occurred'] };
    }
  }

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return null;
    }

    return {
      symbol: this.sanitizeString(data.symbol),
      price: this.sanitizeNumber(data.price),
      volume: this.sanitizeNumber(data.volume),
      timestamp: this.sanitizeTimestamp(data.timestamp),
      source: this.sanitizeString(data.source),
    };
  }

  private sanitizeString(value: any): string {
    if (typeof value !== 'string') {
      return String(value || '').trim();
    }
    return value.trim().replace(/[<>]/g, '');
  }

  private sanitizeNumber(value: any): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    
    const num = parseFloat(value);
    if (isNaN(num) || !isFinite(num)) {
      return undefined;
    }
    
    return Math.max(0, num);
  }

  private sanitizeTimestamp(value: any): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    
    if (typeof value === 'number') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    
    return new Date().toISOString();
  }

  validatePriceRange(price: number, symbol: string): boolean {
    if (price <= 0) {
      this.logger.warn(`Invalid price for ${symbol}: ${price} (must be positive)`);
      return false;
    }

    const reasonablePriceRanges: { [key: string]: { min: number; max: number } } = {
      'BTC': { min: 1000, max: 1000000 },
      'ETH': { min: 100, max: 100000 },
      'default': { min: 0.000001, max: 10000000 }
    };

    const symbolUpper = symbol.toUpperCase();
    const range = reasonablePriceRanges[symbolUpper] || reasonablePriceRanges['default'];

    if (price < range.min || price > range.max) {
      this.logger.warn(`Price out of reasonable range for ${symbol}: ${price} (expected ${range.min}-${range.max})`);
      return false;
    }

    return true;
  }

  validateVolume(volume: number | undefined): boolean {
    if (volume === undefined) {
      return true;
    }

    if (volume < 0) {
      this.logger.warn(`Invalid volume: ${volume} (must be non-negative)`);
      return false;
    }

    return true;
  }
}
