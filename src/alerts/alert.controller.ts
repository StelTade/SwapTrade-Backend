import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AlertService } from './alert.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';

@ApiTags('alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Post(':userId')
  @ApiOperation({ summary: 'Create a new alert rule for a user' })
  @ApiResponse({ status: 201, description: 'Alert rule created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  createAlert(
    @Param('userId', ParseIntPipe) userId: number,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateAlertDto,
  ) {
    return this.alertService.createAlert(userId, dto);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'List all alert rules for a user' })
  @ApiResponse({ status: 200, description: 'Array of alert rules' })
  getAlerts(@Param('userId', ParseIntPipe) userId: number) {
    return this.alertService.getAlerts(userId);
  }

  @Get(':userId/:alertId')
  @ApiOperation({ summary: 'Get a specific alert rule' })
  @ApiResponse({ status: 200, description: 'Alert rule' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — alert belongs to another user' })
  getAlert(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('alertId', ParseIntPipe) alertId: number,
  ) {
    return this.alertService.getAlert(userId, alertId);
  }

  @Patch(':userId/:alertId')
  @ApiOperation({ summary: 'Update an alert rule' })
  @ApiResponse({ status: 200, description: 'Updated alert rule' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  updateAlert(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('alertId', ParseIntPipe) alertId: number,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateAlertDto,
  ) {
    return this.alertService.updateAlert(userId, alertId, dto);
  }

  @Delete(':userId/:alertId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an alert rule' })
  @ApiResponse({ status: 204, description: 'Alert deleted' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  deleteAlert(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('alertId', ParseIntPipe) alertId: number,
  ) {
    return this.alertService.deleteAlert(userId, alertId);
  }

  @Post(':userId/:alertId/pause')
  @ApiOperation({ summary: 'Pause an active alert rule' })
  @ApiResponse({ status: 200, description: 'Alert paused' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  pauseAlert(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('alertId', ParseIntPipe) alertId: number,
  ) {
    return this.alertService.pauseAlert(userId, alertId);
  }

  @Post(':userId/:alertId/resume')
  @ApiOperation({ summary: 'Resume a paused alert rule' })
  @ApiResponse({ status: 200, description: 'Alert resumed' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  resumeAlert(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('alertId', ParseIntPipe) alertId: number,
  ) {
    return this.alertService.resumeAlert(userId, alertId);
  }

  @Get(':userId/:alertId/history')
  @ApiOperation({ summary: 'Get trigger history for an alert' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results (default 50)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Pagination offset (default 0)' })
  @ApiResponse({ status: 200, description: 'Trigger history events' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  getAlertHistory(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('alertId', ParseIntPipe) alertId: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.alertService.getAlertHistory(
      userId,
      alertId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}
