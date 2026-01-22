import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TutorialService } from './tutorial.service';
import { TutorialController } from './tutorial.controller';
import { Tutorial } from './entities/tutorial.entity';
import { TutorialProgress } from './entities/tutorial-progress.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tutorial, TutorialProgress])
  ],
  controllers: [TutorialController],
  providers: [TutorialService],
})
export class TutorialModule {}
