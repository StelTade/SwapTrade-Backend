import { Module } from '@nestjs/common';
import { TutorialService } from './tutorial.service';
import { TutorialController } from './tutorial.controller';

@Module({
  controllers: [TutorialController],
  providers: [TutorialService],
})
export class TutorialModule {}
