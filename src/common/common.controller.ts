import { Controller, Get } from '@nestjs/common';
import { CommonService } from './common.service';

@Controller('common')
export class CommonController {
  constructor(private readonly CommonService: CommonService) {}
  @Get('status')
  getStatus() {
    return { status: 'ok' };
  }
}
