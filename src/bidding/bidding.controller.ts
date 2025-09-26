import { Controller, Post, Body } from '@nestjs/common';
import { BiddingService } from './bidding.service';

@Controller('bidding')
export class BiddingController {
  constructor(private readonly BiddingService: BiddingService) {}
  @Post('create')
  async createBid(@Body() createBidDto: any) {
    return this.BiddingService.CreateBid(createBidDto);
  }
}