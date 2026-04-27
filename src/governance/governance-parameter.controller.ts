import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthenticatedActor } from '../common/security/role-separation';
import { QueueParameterUpdateDto } from './dto/queue-parameter-update.dto';
import { GovernanceParameterService } from './governance-parameter.service';

@ApiTags('governance-parameters')
@Controller('governance/parameters')
export class GovernanceParameterController {
  constructor(
    private readonly governanceParameterService: GovernanceParameterService,
  ) {}

  @Get(':parameterKey')
  getParameter(@Param('parameterKey') parameterKey: string) {
    return this.governanceParameterService.getParameter(parameterKey);
  }

  @Post('updates')
  queueUpdate(
    @Body() dto: QueueParameterUpdateDto,
    @Req() req: { user: AuthenticatedActor },
  ) {
    return this.governanceParameterService.queueParameterUpdate(dto, req.user);
  }

  @Post('updates/:updateId/execute')
  executeUpdate(
    @Param('updateId') updateId: string,
    @Req() req: { user: AuthenticatedActor },
  ) {
    return this.governanceParameterService.executeParameterUpdate(
      updateId,
      req.user,
    );
  }
}
