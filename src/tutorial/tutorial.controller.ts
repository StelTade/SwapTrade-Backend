import { Controller, Get, Post, Param, Body, Patch, Req } from '@nestjs/common';
import { TutorialService } from './tutorial.service';

@Controller('tutorial')
export class TutorialController {
  constructor(private readonly tutorialService: TutorialService) {}

  @Get()
  async findAll() {
    return this.tutorialService.findAll();
  }

  @Post(':id/start')
  async start(@Req() req, @Param('id') tutorialId: string) {
    const userId = req.user.id; // assume JWT middleware
    return this.tutorialService.startTutorial(userId, tutorialId);
  }

  @Patch(':id/progress')
  async updateProgress(@Req() req, @Param('id') tutorialId: string, @Body('step') step: number) {
    const userId = req.user.id;
    return this.tutorialService.updateProgress(userId, tutorialId, step);
  }

  @Get(':id/progress')
  async getProgress(@Req() req, @Param('id') tutorialId: string) {
    const userId = req.user.id;
    return this.tutorialService.getProgress(userId, tutorialId);
  }
}
