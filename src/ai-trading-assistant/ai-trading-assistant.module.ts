import { Module } from '@nestjs/common';
import { AiTradingAssistantController } from './ai-trading-assistant.controller';
import { AiTradingAssistantService } from './ai-trading-assistant.service';

@Module({
  controllers: [AiTradingAssistantController],
  providers: [AiTradingAssistantService],
  exports: [AiTradingAssistantService],
})
export class AiTradingAssistantModule {}
