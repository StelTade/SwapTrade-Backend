import { Controller, Post, Body, Req } from '@nestjs/common';
import { BiddingService } from './bidding.service';
import { CreateBidDto } from './dto/create-bid.dto';

@Controller('bidding')
export class BiddingController {
  constructor(private readonly biddingService: BiddingService) {}

 @Post()
async createBid(
  @Req() req,
  @Body() dto: CreateBidDto,
) {
  await this.biddingService.validateBid(req.user.id, dto);
  return this.biddingService.createBid(req.user.id, dto);
}

}
