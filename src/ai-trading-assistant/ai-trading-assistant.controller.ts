import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AiTradingAssistantService } from './ai-trading-assistant.service';
import { AssistantQueryDto } from './dto/assistant-query.dto';
import { RiskWarningDto } from './dto/risk-warning.dto';

@Controller('ai-trading-assistant')
export class AiTradingAssistantController {
  constructor(
    private readonly aiTradingAssistantService: AiTradingAssistantService,
  ) {}

  @Post('ask')
  ask(@Body() dto: AssistantQueryDto) {
    return this.aiTradingAssistantService.ask(dto);
  }

  @Post('risk-warning')
  assessTradeRisk(@Body() dto: RiskWarningDto) {
    return this.aiTradingAssistantService.assessTradeRisk(dto);
  }

  @Get('sessions/:sessionId/history')
  getSessionHistory(@Param('sessionId') sessionId: string) {
    return this.aiTradingAssistantService.getSessionHistory(sessionId);
  }

  @Get('interactions')
  getInteractionLogs() {
    return this.aiTradingAssistantService.getInteractionLogs();
  }
}
