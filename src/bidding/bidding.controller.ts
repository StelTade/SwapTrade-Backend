import { Controller, Post, Body } from '@nestjs/common';
import { BiddingService } from './bidding.service';
import { CreateBidDto } from './dto/create-bid.dto';

@Controller('bidding')
export class BiddingController {
  constructor(private readonly biddingService: BiddingService) {}

  @Post('create')
  async createBid(@Body() createBidDto: CreateBidDto) {
    return await this.biddingService.createBid(createBidDto);
  }
}
