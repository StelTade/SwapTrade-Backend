import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Request, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { CryptocurrencyService } from './cryptocurrency.service';
import { CreateCryptocurrencyDto } from './dto/create-cryptocurrency.dto';
import { UpdateCryptocurrencyDto } from './dto/update-cryptocurrency.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guard/roles.guard';

@Controller('assets')
export class CryptocurrencyController {
  constructor(private readonly cryptocurrencyService: CryptocurrencyService) {}

  @Get()
  async findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    // Pagination can be improved as needed
    const all = await this.cryptocurrencyService.findAll();
    const start = (page - 1) * limit;
    return {
      data: all.slice(start, start + limit),
      total: all.length,
      page: Number(page),
      limit: Number(limit),
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.cryptocurrencyService.findOne(+id);
  }

  @Post()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createCryptocurrencyDto: CreateCryptocurrencyDto) {
    return this.cryptocurrencyService.create(createCryptocurrencyDto);
  }

  @Put(':id')
  @Roles('admin')
  @UseGuards(RolesGuard)
  async update(@Param('id') id: string, @Body() updateCryptocurrencyDto: UpdateCryptocurrencyDto) {
    return this.cryptocurrencyService.update(+id, updateCryptocurrencyDto);
  }

  @Delete(':id')
  @Roles('admin')
  @UseGuards(RolesGuard)
  async remove(@Param('id') id: string) {
    return this.cryptocurrencyService.remove(+id);
  }
}
