import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ErrorService } from './error.service';

@ApiTags('Error Reference')
@Controller('error-reference')
export class ErrorController {
  constructor(private readonly errorService: ErrorService) {}

  @Get()
  @ApiOperation({ summary: 'Get all defined error codes and meanings' })
  @ApiResponse({
    status: 200,
    description: 'List of all error codes with their definitions',
  })
  getAllErrorCodes() {
    return this.errorService.getAllErrorCodes();
  }
}
