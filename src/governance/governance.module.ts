import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovernanceProposal } from './entities/governance-proposal.entity';
import { GovernanceParameter } from './entities/governance-parameter.entity';
import { GovernanceStake } from './entities/governance-stake.entity';
import { GovernanceVote } from './entities/governance-vote.entity';
import { PendingGovernanceParameterUpdate } from './entities/pending-governance-parameter-update.entity';
import { GovernanceParameterController } from './governance-parameter.controller';
import { GovernanceParameterService } from './governance-parameter.service';
import { GovernanceController } from './governance.controller';
import { GovernanceService } from './governance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GovernanceProposal,
      GovernanceVote,
      GovernanceStake,
      GovernanceParameter,
      PendingGovernanceParameterUpdate,
    ]),
  ],
  controllers: [GovernanceController, GovernanceParameterController],
  providers: [GovernanceService, GovernanceParameterService],
  exports: [GovernanceService, GovernanceParameterService],
})
export class GovernanceModule {}
