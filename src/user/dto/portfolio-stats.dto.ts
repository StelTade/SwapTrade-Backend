import { IsString, IsNumber, IsDate, IsOptional, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsAssetType } from '../../common/validation';

class CurrentBalanceDto {
  @IsAssetType()
  asset: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  trades: number;

  @IsNumber()
  pnl: number;
}

export class PortfolioStatsDto {
    @IsString()
    userId: string;
    
    @IsNumber()
    totalTrades: number;
    
    @IsNumber()
    cumulativePnL: number;
    
    @IsNumber()
    totalTradeVolume: number;
    
    @IsDate()
    @IsOptional()
    lastTradeDate: Date | null;
    
    @ArrayMinSize(0)
    @ValidateNested({ each: true })
    @Type(() => CurrentBalanceDto)
    currentBalances: CurrentBalanceDto[];
}