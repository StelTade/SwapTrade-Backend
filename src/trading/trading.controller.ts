import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { TradingService } from './trading.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('trading')
@Controller('trading')
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Post('swap')
  @ApiOperation({ summary: 'Execute a trade and update portfolio stats' })
  @ApiResponse({ status: 201, description: 'Trade executed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid trade parameters' })
  @ApiBody({ type: CreateTradeDto })
  async swap(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    body: CreateTradeDto,
  ) {
    const { userId, asset, amount, price, type } = body;
    return this.tradingService.swap(userId, asset, amount, price, type);
  }
}
