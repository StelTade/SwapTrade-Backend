/**
 * Swap Controller
 *
 * Handles HTTP requests related to swap operations.
 */
import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { SwapService } from './swap.service';
import { CreateSwapDto } from './dto/create-swap.dto';

@Controller('swap')
export class SwapController {
  constructor(private readonly swapService: SwapService) {}

  @Post()
  async swap(@Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) body: CreateSwapDto) {
    return this.swapService.executeSwap(body);
  }
}
