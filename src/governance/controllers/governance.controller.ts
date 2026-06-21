import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProposalManagementService } from '../services/index';
import { GovernanceService } from '../services/governance.service';
import { VotingService } from '../services/index';
import { DelegationService } from '../services/index';
import { DiscussionService } from '../services/index';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ProposalType, ProposalStatus, VoteType } from '../enums/governance.enum';

@ApiTags('Governance')
@ApiBearerAuth()
@Controller('governance')
@UseGuards(JwtAuthGuard)
export class GovernanceProposalController {
  constructor(
    private readonly proposalManagement: ProposalManagementService,
    private readonly votingService: VotingService,
    private readonly delegationService: DelegationService,
    private readonly discussionService: DiscussionService,
    private readonly governanceService: GovernanceService,
  ) {}

  @Post('proposals')
  @ApiOperation({ summary: 'Create a new governance proposal' })
  async createProposal(
    @Body() dto: any,
    @Request() req: any,
  ) {
    const userId = String(req.user?.id);
    const proposerAddress = req.user?.address ?? `0x${userId}`;
    return this.proposalManagement.createProposal(
      userId,
      proposerAddress,
      dto.type,
      dto.title,
      dto.description,
      dto.parameters ?? {},
      dto.executionPayload,
    );
  }

  @Get('proposals')
  @ApiOperation({ summary: 'List all proposals' })
  async getProposals() {
    return this.governanceService.getProposalHistory();
  }

  @Get('proposals/:id')
  @ApiOperation({ summary: 'Get proposal details' })
  async getProposal(@Param('id') id: string) {
    return this.proposalManagement;
  }

  @Post('proposals/:id/approve')
  @ApiOperation({ summary: 'Approve a proposal for voting' })
  async approveProposal(@Param('id') id: string, @Request() req: any) {
    return this.proposalManagement.approveProposal(id, String(req.user?.id));
  }

  @Post('proposals/:id/cancel')
  @ApiOperation({ summary: 'Cancel a proposal' })
  async cancelProposal(@Param('id') id: string, @Body() dto: { reason: string }) {
    return this.proposalManagement.cancelProposal(id, dto.reason);
  }

  @Post('proposals/:id/vote')
  @ApiOperation({ summary: 'Cast a vote on a proposal' })
  async castVote(
    @Param('id') proposalId: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    const voterId = String(req.user?.id);
    const voterAddress = req.user?.address ?? `0x${voterId}`;
    return this.votingService.castVote(
      proposalId,
      voterId,
      voterAddress,
      dto.voteType,
      dto.reason,
    );
  }

  @Post('proposals/:id/finalize')
  @ApiOperation({ summary: 'Finalize a proposal after voting ends' })
  async finalizeProposal(@Param('id') id: string) {
    return this.proposalManagement.finalizeProposal(id);
  }

  @Post('proposals/:id/discussions')
  @ApiOperation({ summary: 'Add a discussion message to a proposal' })
  async addDiscussion(
    @Param('id') proposalId: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.discussionService.addMessage(
      proposalId,
      String(req.user?.id),
      req.user?.address ?? `0x${String(req.user?.id)}`,
      dto.messageType,
      dto.content,
    );
  }

  @Get('proposals/:id/discussions')
  @ApiOperation({ summary: 'Get proposal discussion thread' })
  async getDiscussions(@Param('id') proposalId: string) {
    return this.discussionService.getDiscussionThread(proposalId);
  }
}

@Controller('governance/delegation')
@UseGuards(JwtAuthGuard)
export class GovernanceDelegationController {
  constructor(private readonly delegationService: DelegationService) {}

  @Post('delegate')
  @ApiOperation({ summary: 'Delegate voting power to another user' })
  async delegate(
    @Body() dto: { delegateeId: string; delegationDays?: number },
    @Request() req: any,
  ) {
    return this.delegationService.delegateVotes(
      String(req.user?.id),
      dto.delegateeId,
      dto.delegationDays ?? 30,
    );
  }

  @Post('revoke/:delegationId')
  @ApiOperation({ summary: 'Revoke a delegation' })
  async revoke(@Param('delegationId') delegationId: string) {
    return this.delegationService.revokeDelegation(delegationId);
  }

  @Get('my-delegations')
  @ApiOperation({ summary: 'Get my active delegations' })
  async myDelegations(@Request() req: any) {
    return this.delegationService.getActiveDelegations(String(req.user?.id));
  }

  @Get('received/:delegateeId')
  @ApiOperation({ summary: 'Get delegations received by a user' })
  async received(@Param('delegateeId') delegateeId: string) {
    return this.delegationService.getDelegatorsForUser(delegateeId);
  }
}

@Controller('governance/history')
@UseGuards(JwtAuthGuard)
export class GovernanceHistoryController {
  constructor(private readonly governanceService: GovernanceService) {}

  @Get('voting')
  @ApiOperation({ summary: 'Get voting history for the current user' })
  async votingHistory(@Request() req: any) {
    return this.governanceService.getVotingHistory(String(req.user?.id));
  }

  @Get('proposals')
  @ApiOperation({ summary: 'Get governance history for the current user' })
  async proposalHistory(@Request() req: any) {
    return this.governanceService.getProposalHistory(String(req.user?.id));
  }
}

@Controller('governance/config')
@UseGuards(JwtAuthGuard)
export class GovernanceConfigController {
  constructor(private readonly governanceService: GovernanceService) {}

  @Get()
  @ApiOperation({ summary: 'Get governance configuration parameters' })
  async getConfig() {
    return {
      votingPeriodDays: await this.governanceService.getVotingPeriodDays(),
      minTokenThreshold: await this.governanceService.getMinTokenThreshold(),
      quorumPercentage: await this.governanceService.getQuorumPercentage(),
      passThresholdPercentage: await this.governanceService.getPassThresholdPercentage(),
      maxTitleLength: await this.governanceService.getMaxTitleLength(),
    };
  }
}
