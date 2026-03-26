import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { ReferralService } from './referral.service';
import { CreateReferralDto, ReferralCallbackDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/decorators/swagger-error-responses.decorator';

@ApiTags('referral')
@Controller('api/waitlist/referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create referral',
    description: 'Create a new referral relationship between two users',
  })
  @ApiBody({ type: CreateReferralDto })
  @ApiResponse({ status: 201, description: 'Referral created successfully' })
  @ApiErrorResponses()
  async createReferral(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    dto: CreateReferralDto,
  ) {
    return this.referralService.createReferral(dto);
  }

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Referral callback',
    description: 'Process referral callback when referee verifies their email',
  })
  @ApiBody({ type: ReferralCallbackDto })
  @ApiResponse({
    status: 200,
    description: 'Referral callback processed successfully',
  })
  @ApiErrorResponses()
  async referralCallback(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    dto: ReferralCallbackDto,
  ) {
    return this.referralService.processReferralCallback(dto);
  }

  @Get('user/:id')
  @ApiOperation({
    summary: 'Get user referral stats',
    description: 'Get referral statistics for a user',
  })
  @ApiResponse({
    status: 200,
    description: 'Referral stats retrieved successfully',
  })
  @ApiErrorResponses()
  async getUserReferralStats(@Param('id', ParseIntPipe) id: number) {
    return this.referralService.getUserReferralStats(id);
  }

  @Get('user/:id/list')
  @ApiOperation({
    summary: 'Get user referrals list',
    description: 'Get list of all referrals made by a user',
  })
  @ApiResponse({
    status: 200,
    description: 'Referral list retrieved successfully',
  })
  @ApiErrorResponses()
  async getUserReferrals(@Param('id', ParseIntPipe) id: number) {
    return this.referralService.getUserReferrals(id);
  }

  @Get('code/:code')
  @ApiOperation({
    summary: 'Get referrals by code',
    description: 'Get all referrals made using a specific referral code',
  })
  @ApiResponse({ status: 200, description: 'Referrals retrieved successfully' })
  @ApiErrorResponses()
  async getReferralsByCode(@Param('code') code: string) {
    return this.referralService.getReferralByCode(code);
  }
}
