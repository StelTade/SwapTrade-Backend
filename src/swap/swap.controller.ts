/**
 * Swap Controller
 *
 * Handles HTTP requests related to swap operations.
 */
import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { SwapService } from './swap.service';
import { CreateSwapDto } from './dto/create-swap.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBadRequestResponse, ApiNotFoundResponse } from '@nestjs/swagger';

@ApiTags('swap')
@Controller('swap')
export class SwapController {
  constructor(private readonly swapService: SwapService) {}

  @Post()
  @ApiOperation({ summary: 'Execute a token swap' })
  @ApiResponse({ status: 200, description: 'Swap executed successfully' })
  @ApiBadRequestResponse({ description: 'Bad request - Invalid input data' })
  @ApiNotFoundResponse({ description: 'Not found - Unsupported token' })
  @ApiBody({ type: CreateSwapDto })
  async swap(@Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) body: CreateSwapDto) {
    return this.swapService.executeSwap(body);
  }
}