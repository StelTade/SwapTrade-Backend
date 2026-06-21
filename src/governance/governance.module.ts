import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GovernanceProposal } from './entities/governance-proposal.entity';
import { GovernanceVote } from './entities/governance-vote.entity';
import { GovernanceDiscussion } from './entities/governance-discussion.entity';
import { VoteDelegation } from './entities/vote-delegation.entity';
import { GovernanceExecution } from './entities/governance-execution.entity';
import { GovernanceConfig } from './entities/governance-config.entity';
import { TokenHolding } from './entities/token-holding.entity';
import {
  GovernanceService,
  ProposalManagementService,
  VotingService,
  DelegationService,
  DiscussionService,
  ProposalExecutionService,
} from './services';
import {
  GovernanceProposalController,
  GovernanceDelegationController,
  GovernanceHistoryController,
  GovernanceConfigController,
} from './controllers';
import { GOVERNANCE_PARAMS } from './constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GovernanceProposal,
      GovernanceVote,
      GovernanceDiscussion,
      VoteDelegation,
      GovernanceExecution,
      GovernanceConfig,
      TokenHolding,
    ]),
    EventEmitterModule,
  ],
  controllers: [
    GovernanceProposalController,
    GovernanceDelegationController,
    GovernanceHistoryController,
    GovernanceConfigController,
  ],
  providers: [
    GovernanceService,
    ProposalManagementService,
    VotingService,
    DelegationService,
    DiscussionService,
    ProposalExecutionService,
  ],
  exports: [
    GovernanceService,
    ProposalManagementService,
    VotingService,
    DelegationService,
    DiscussionService,
    ProposalExecutionService,
  ],
})
export class GovernanceModule {
  static readonly PARAMS = GOVERNANCE_PARAMS;
}
