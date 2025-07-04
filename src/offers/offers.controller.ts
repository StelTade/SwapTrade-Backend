import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { ActiveUser } from '../auth/decorators/activeUser.decorator';
import { AuthGuardGuard } from '../auth/guard/auth-guard/auth-guard.guard';

@Controller('offers')
@UseGuards(AuthGuardGuard)
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  async create(
    @ActiveUser('sub') userId: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) createOfferDto: CreateOfferDto,
  ) {
    return this.offersService.createOffer(createOfferDto, userId);
  }

  @Get()
  async findAll(
    @ActiveUser('sub') userId: number,
    @Query(new ValidationPipe({ transform: true })) query: QueryOffersDto,
  ) {
    return this.offersService.findAll(query, userId);
  }

  @Get(':id')
  async findOne(
    @ActiveUser('sub') userId: number,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.offersService.findOne(id, userId);
  }

  @Patch(':id/accept')
  @HttpCode(HttpStatus.OK)
  async accept(
    @ActiveUser('sub') userId: number,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.offersService.acceptOffer(id, userId);
  }

  @Patch(':id/decline')
  @HttpCode(HttpStatus.OK)
  async decline(
    @ActiveUser('sub') userId: number,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.offersService.declineOffer(id, userId);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @ActiveUser('sub') userId: number,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.offersService.cancelOffer(id, userId);
  }

  @Patch(':id')
  async update(
    @ActiveUser('sub') userId: number,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) updateOfferDto: UpdateOfferDto,
  ) {
    return this.offersService.updateOffer(id, updateOfferDto, userId);
  }
} 