import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GovernanceProposal,
  GovernanceVote,
  GovernanceDiscussion,
  VoteDelegation,
  GovernanceExecution,
  ProposalStatus,
  ProposalType,
  VoteType,
  DiscussionMessageType,
  ExecutionStatus,
  TokenHolding,
  GOVERNANCE_PARAMS,
} from '../constants/governance.constants';
import { GovernanceService } from './governance.service';

@Injectable()
export class ProposalExecutionService {
  private readonly logger = new Logger(ProposalExecutionService.name);

  constructor(
    @InjectRepository(GovernanceProposal)
    private readonly proposalRepo: Repository<GovernanceProposal>,
    @InjectRepository(GovernanceExecution)
    private readonly execRepo: Repository<GovernanceExecution>,
    private readonly governanceService: GovernanceService,
  ) {}

  async executeProposal(proposalId: string, actorId: string): Promise<GovernanceExecution> {
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== ProposalStatus.PASSED) {
      throw new BadRequestException('Only passed proposals can be executed');
    }

    const execution = this.execRepo.create({
      proposalId,
      executionStatus: ExecutionStatus.PENDING,
      executedBy: actorId,
    });

    try {
      proposal.status = ProposalStatus.EXECUTED;
      proposal.executedAt = new Date();
      await this.proposalRepo.save(proposal);
      execution.executionStatus = ExecutionStatus.SUCCESS;
      execution.transactionHash = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    } catch (err) {
      this.logger.error(`Failed to execute proposal ${proposalId}`, err);
      proposal.status = ProposalStatus.PASSED;
      proposal.executionReason = (err as Error).message;
      await this.proposalRepo.save(proposal);
      execution.executionStatus = ExecutionStatus.FAILED;
      execution.errorMessage = (err as Error).message;
    }

    return this.execRepo.save(execution);
  }
}

@Injectable()
export class ProposalManagementService {
  private readonly logger = new Logger(ProposalManagementService.name);

  constructor(
    @InjectRepository(GovernanceProposal)
    private readonly proposalRepo: Repository<GovernanceProposal>,
    @InjectRepository(GovernanceVote)
    private readonly voteRepo: Repository<GovernanceVote>,
    @InjectRepository(GovernanceDiscussion)
    private readonly discussionRepo: Repository<GovernanceDiscussion>,
    @InjectRepository(TokenHolding)
    private readonly holdingRepo: Repository<TokenHolding>,
    @InjectRepository(VoteDelegation)
    private readonly delegationRepo: Repository<VoteDelegation>,
    private readonly governanceService: GovernanceService,
  ) {}

  async createProposal(
    proposerId: string,
    proposerAddress: string,
    type: ProposalType,
    title: string,
    description: string,
    parameters: Record<string, any>,
    executionPayload?: Record<string, any>,
  ): Promise<GovernanceProposal> {
    const threshold = await this.governanceService.getMinTokenThreshold();
    const balance = await this.governanceService.getTokenBalance(proposerId);

    if (balance < threshold) {
      throw new ForbiddenException(
        `Minimum token threshold not met. Required: ${threshold}, Current: ${balance}`,
      );
    }

    const votingPeriodDays = type === ProposalType.EMERGENCY
      ? await this.governanceService.getEmergencyVotingPeriodDays()
      : await this.governanceService.getVotingPeriodDays();

    const startTime = new Date();
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + votingPeriodDays);

    const proposal = this.proposalRepo.create({
      proposerId,
      proposerAddress,
      type,
      title,
      description,
      parameters,
      executionPayload,
      status: ProposalStatus.PENDING,
      forVotes: 0,
      againstVotes: 0,
      abstainVotes: 0,
      quorumVotes: GOVERNANCE_PARAMS.QUORUM_PERCENTAGE.value,
      totalSupply: balance,
      votingPeriodDays,
      startTime,
      endTime,
    });

    return this.proposalRepo.save(proposal);
  }

  async approveProposal(proposalId: string, actorId: string): Promise<GovernanceProposal> {
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    const votingPeriodDays = proposal.type === ProposalType.EMERGENCY
      ? await this.governanceService.getEmergencyVotingPeriodDays()
      : await this.governanceService.getVotingPeriodDays();

    const startTime = new Date();
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + votingPeriodDays);

    proposal.status = ProposalStatus.ACTIVE;
    proposal.startTime = startTime;
    proposal.endTime = endTime;
    proposal.votingPeriodDays = votingPeriodDays;

    return this.proposalRepo.save(proposal);
  }

  async cancelProposal(proposalId: string, reason: string): Promise<GovernanceProposal> {
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    if (proposal.status === ProposalStatus.ACTIVE || proposal.status === ProposalStatus.EXECUTED) {
      throw new BadRequestException(`Cannot cancel proposal in status ${proposal.status}`);
    }

    proposal.status = ProposalStatus.CANCELLED;
    proposal.cancellationReason = reason;
    return this.proposalRepo.save(proposal);
  }

  async finalizeProposal(proposalId: string): Promise<GovernanceProposal> {
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== ProposalStatus.ACTIVE) {
      throw new BadRequestException(`Only active proposals can be finalized`);
    }

    const now = new Date();
    if (now < proposal.endTime) {
      throw new BadRequestException(`Voting period has not ended yet`);
    }

    proposal.totalSupply = proposal.totalSupply || (proposal.forVotes + proposal.againstVotes + proposal.abstainVotes);

    const hasPassed = await this.governanceService.proposalHasPassed(proposalId);
    proposal.status = hasPassed ? ProposalStatus.PASSED : ProposalStatus.DEFEATED;

    return this.proposalRepo.save(proposal);
  }
}

@Injectable()
export class VotingService {
  constructor(
    @InjectRepository(GovernanceVote)
    private readonly voteRepo: Repository<GovernanceVote>,
    @InjectRepository(GovernanceProposal)
    private readonly proposalRepo: Repository<GovernanceProposal>,
    @InjectRepository(VoteDelegation)
    private readonly delegationRepo: Repository<VoteDelegation>,
    private readonly governanceService: GovernanceService,
  ) {}

  async castVote(
    proposalId: string,
    voterId: string,
    voterAddress: string,
    voteType: VoteType,
    reason?: string,
  ): Promise<GovernanceVote> {
    const canVote = await this.governanceService.canUserVote(voterId, proposalId);
    if (!canVote.allowed) {
      throw new ForbiddenException(canVote.reason);
    }

    if (!Object.values(VoteType).includes(voteType)) {
      throw new BadRequestException(`Invalid vote type: ${voteType}`);
    }

    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    const votingPower = await this.governanceService.getEffectiveVotingPower(voterId, proposalId);
    if (votingPower <= 0) {
      throw new BadRequestException('No voting power available');
    }

    const vote = this.voteRepo.create({
      proposalId,
      voterId,
      voterAddress,
      voteType,
      weight: votingPower,
      balanceAtVote: await this.governanceService.getTokenBalance(voterId),
      delegateTo: null,
      timestamp: new Date(),
      reason: reason ?? null,
    });

    const saved = await this.voteRepo.save(vote);

    if (voteType === VoteType.FOR) {
      proposal.forVotes += votingPower;
    } else if (voteType === VoteType.AGAINST) {
      proposal.againstVotes += votingPower;
    } else if (voteType === VoteType.ABSTAIN) {
      proposal.abstainVotes += votingPower;
    }

    await this.proposalRepo.save(proposal);
    return saved;
  }
}

@Injectable()
export class DelegationService {
  constructor(
    @InjectRepository(VoteDelegation)
    private readonly delegationRepo: Repository<VoteDelegation>,
    private readonly governanceService: GovernanceService,
  ) {}

  async delegateVotes(
    delegatorId: string,
    delegateeId: string,
    delegationDays: number = 30,
  ): Promise<VoteDelegation> {
    if (delegatorId === delegateeId) {
      throw new BadRequestException('Cannot delegate to yourself');
    }

    const existing = await this.delegationRepo.findOne({
      where: { delegatorId, delegateeId, isActive: true },
    });

    if (existing) {
      throw new BadRequestException('Active delegation already exists for this delegatee');
    }

    const balance = await this.governanceService.getTokenBalance(delegatorId);
    if (balance <= 0) {
      throw new BadRequestException('Cannot delegate without token holdings');
    }

    const endTime = new Date();
    endTime.setDate(endTime.getDate() + delegationDays);

    const delegation = this.delegationRepo.create({
      delegatorId,
      delegatorAddress: `0x${delegatorId}`,
      delegateeId,
      delegateeAddress: `0x${delegateeId}`,
      delegatedBalance: balance,
      isActive: true,
      startTime: new Date(),
      endTime,
    });

    return this.delegationRepo.save(delegation);
  }

  async revokeDelegation(delegationId: string): Promise<VoteDelegation> {
    const delegation = await this.delegationRepo.findOne({ where: { id: delegationId } });
    if (!delegation) {
      throw new BadRequestException('Delegation not found');
    }
    if (!delegation.isActive) {
      throw new BadRequestException('Delegation is already inactive');
    }

    delegation.isActive = false;
    delegation.endTime = new Date();
    return this.delegationRepo.save(delegation);
  }

  async getActiveDelegations(delegatorId: string): Promise<VoteDelegation[]> {
    return this.delegationRepo.find({
      where: { delegatorId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getDelegatorsForUser(delegateeId: string): Promise<VoteDelegation[]> {
    return this.delegationRepo.find({
      where: { delegateeId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }
}

@Injectable()
export class DiscussionService {
  constructor(
    @InjectRepository(GovernanceDiscussion)
    private readonly discussionRepo: Repository<GovernanceDiscussion>,
  ) {}

  async addMessage(
    proposalId: string,
    authorId: string,
    authorAddress: string,
    messageType: DiscussionMessageType,
    content: string,
  ): Promise<GovernanceDiscussion> {
    const discussion = this.discussionRepo.create({
      proposalId,
      authorId,
      authorAddress,
      messageType,
      content,
    });

    return this.discussionRepo.save(discussion);
  }

  async getDiscussionThread(proposalId: string): Promise<GovernanceDiscussion[]> {
    return this.discussionRepo.find({
      where: { proposalId },
      order: { createdAt: 'ASC' },
    });
  }
}


    if (proposal.status !== ProposalStatus.PASSED) {
      throw new BadRequestException('Only passed proposals can be executed');
    }

    const execution = this.execRepo.create({
      proposalId,
      executionStatus: ExecutionStatus.PENDING,
      executedBy: { actorId, timestamp: new Date().toISOString() },
    });

    try {
      proposal.status = ProposalStatus.EXECUTED;
      proposal.executedAt = new Date();
      await this.proposalRepo.save(proposal);
      execution.executionStatus = ExecutionStatus.SUCCESS;
      execution.transactionHash = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    } catch (err) {
      this.logger.error(`Failed to execute proposal ${proposalId}`, err);
      proposal.status = ProposalStatus.PASSED;
      proposal.executionReason = (err as Error).message;
      await this.proposalRepo.save(proposal);
      execution.executionStatus = ExecutionStatus.FAILED;
      execution.errorMessage = (err as Error).message;
    }

    const saved = await this.execRepo.save(execution);
    this.eventEmitter.emit('governance.proposal.executed', { proposalId, status: execution.executionStatus });
    return saved;
  }
}

    if (proposal.status !== ProposalStatus.PASSED) {
      throw new BadRequestException('Only passed proposals can be executed');
    }

    const execution = this.execRepo.create({
      proposalId,
      executionStatus: ExecutionStatus.PENDING,
      executedBy: { actorId, timestamp: new Date().toISOString() },
    });

    try {
      proposal.status = ProposalStatus.EXECUTED;
      proposal.executedAt = new Date();
      await this.proposalRepo.save(proposal);
      execution.executionStatus = ExecutionStatus.SUCCESS;
      execution.transactionHash = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    } catch (err) {
      this.logger.error(`Failed to execute proposal ${proposalId}`, err);
      proposal.status = ProposalStatus.PASSED;
      proposal.executionReason = (err as Error).message;
      await this.proposalRepo.save(proposal);
      execution.executionStatus = ExecutionStatus.FAILED;
      execution.errorMessage = (err as Error).message;
    }

    const saved = await this.execRepo.save(execution);
    this.eventEmitter.emit('governance.proposal.executed', { proposalId, status: execution.executionStatus });

    return saved;
  }
}

@Injectable()
export class ProposalManagementService {
  private readonly logger = new Logger(ProposalManagementService.name);

  constructor(
    @InjectRepository(GovernanceProposal)
    private readonly proposalRepo: Repository<GovernanceProposal>,
    @InjectRepository(GovernanceVote)
    private readonly voteRepo: Repository<GovernanceVote>,
    @InjectRepository(GovernanceDiscussion)
    private readonly discussionRepo: Repository<GovernanceDiscussion>,
    @InjectRepository(TokenHolding)
    private readonly holdingRepo: Repository<TokenHolding>,
    @InjectRepository(VoteDelegation)
    private readonly delegationRepo: Repository<VoteDelegation>,
    private readonly governanceService: GovernanceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createProposal(
    proposerId: string,
    proposerAddress: string,
    type: ProposalType,
    title: string,
    description: string,
    parameters: Record<string, any>,
    executionPayload?: Record<string, any>,
  ): Promise<GovernanceProposal> {
    const threshold = await this.governanceService.getMinTokenThreshold();
    const balance = await this.governanceService.getTokenBalance(proposerId);

    if (balance < threshold) {
      throw new ForbiddenException(
        `Minimum token threshold not met. Required: ${threshold}, Current: ${balance}`,
      );
    }

    const votingPeriodDays = type === ProposalType.EMERGENCY
      ? await this.governanceService.getEmergencyVotingPeriodDays()
      : await this.governanceService.getVotingPeriodDays();

    const startTime = new Date();
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + votingPeriodDays);

    const proposal = this.proposalRepo.create({
      proposerId,
      proposerAddress,
      type,
      title,
      description,
      parameters,
      executionPayload,
      status: ProposalStatus.PENDING,
      forVotes: 0,
      againstVotes: 0,
      abstainVotes: 0,
      quorumVotes: GOVERNANCE_PARAMS.QUORUM_PERCENTAGE.value,
      totalSupply: balance,
      votingPeriodDays,
      startTime,
      endTime,
    });

    const saved = await this.proposalRepo.save(proposal);
    this.eventEmitter.emit('governance.proposal.created', { proposal: saved });
    return saved;
  }

  async approveProposal(proposalId: string, actorId: string): Promise<GovernanceProposal> {
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    const votingPeriodDays = proposal.type === ProposalType.EMERGENCY
      ? await this.governanceService.getEmergencyVotingPeriodDays()
      : await this.governanceService.getVotingPeriodDays();

    const startTime = new Date();
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + votingPeriodDays);

    proposal.status = ProposalStatus.ACTIVE;
    proposal.startTime = startTime;
    proposal.endTime = endTime;
    proposal.votingPeriodDays = votingPeriodDays;

    return this.proposalRepo.save(proposal);
  }

  async cancelProposal(proposalId: string, reason: string): Promise<GovernanceProposal> {
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    if (proposal.status === ProposalStatus.ACTIVE || proposal.status === ProposalStatus.EXECUTED) {
      throw new BadRequestException(`Cannot cancel proposal in status ${proposal.status}`);
    }

    proposal.status = ProposalStatus.CANCELLED;
    proposal.cancellationReason = reason;
    return this.proposalRepo.save(proposal);
  }

  async finalizeProposal(proposalId: string): Promise<GovernanceProposal> {
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== ProposalStatus.ACTIVE) {
      throw new BadRequestException(`Only active proposals can be finalized`);
    }

    const now = new Date();
    if (now < proposal.endTime) {
      throw new BadRequestException(`Voting period has not ended yet`);
    }

    proposal.totalSupply = proposal.totalSupply || (proposal.forVotes + proposal.againstVotes + proposal.abstainVotes);

    const hasPassed = await this.governanceService.proposalHasPassed(proposalId);
    proposal.status = hasPassed ? ProposalStatus.PASSED : ProposalStatus.DEFEATED;

    return this.proposalRepo.save(proposal);
  }
}

@Injectable()
export class VotingService {
  private readonly logger = new Logger(VotingService.name);

  constructor(
    @InjectRepository(GovernanceVote)
    private readonly voteRepo: Repository<GovernanceVote>,
    @InjectRepository(GovernanceProposal)
    private readonly proposalRepo: Repository<GovernanceProposal>,
    @InjectRepository(VoteDelegation)
    private readonly delegationRepo: Repository<VoteDelegation>,
    private readonly governanceService: GovernanceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async castVote(
    proposalId: string,
    voterId: string,
    voterAddress: string,
    voteType: VoteType,
    reason?: string,
  ): Promise<GovernanceVote> {
    const canVote = await this.governanceService.canUserVote(voterId, proposalId);
    if (!canVote.allowed) {
      throw new ForbiddenException(canVote.reason);
    }

    if (!Object.values(VoteType).includes(voteType)) {
      throw new BadRequestException(`Invalid vote type: ${voteType}`);
    }

    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    const votingPower = await this.governanceService.getEffectiveVotingPower(voterId, proposalId);
    if (votingPower <= 0) {
      throw new BadRequestException('No voting power available');
    }

    const vote = this.voteRepo.create({
      proposalId,
      voterId,
      voterAddress,
      voteType,
      weight: votingPower,
      balanceAtVote: await this.governanceService.getTokenBalance(voterId),
      delegateTo: null,
      timestamp: new Date(),
      reason: reason ?? null,
    });

    const saved = await this.voteRepo.save(vote);

    if (voteType === VoteType.FOR) {
      proposal.forVotes += votingPower;
    } else if (voteType === VoteType.AGAINST) {
      proposal.againstVotes += votingPower;
    } else if (voteType === VoteType.ABSTAIN) {
      proposal.abstainVotes += votingPower;
    }

    await this.proposalRepo.save(proposal);
    this.eventEmitter.emit('governance.vote.cast', { proposalId, vote: saved });
    return saved;
  }
}

@Injectable()
export class DelegationService {
  private readonly logger = new Logger(DelegationService.name);

  constructor(
    @InjectRepository(VoteDelegation)
    private readonly delegationRepo: Repository<VoteDelegation>,
    private readonly governanceService: GovernanceService,
  ) {}

  async delegateVotes(
    delegatorId: string,
    delegateeId: string,
    delegationDays: number = 30,
  ): Promise<VoteDelegation> {
    if (delegatorId === delegateeId) {
      throw new BadRequestException('Cannot delegate to yourself');
    }

    const existing = await this.delegationRepo.findOne({
      where: { delegatorId, delegateeId, isActive: true },
    });

    if (existing) {
      throw new BadRequestException('Active delegation already exists for this delegatee');
    }

    const balance = await this.governanceService.getTokenBalance(delegatorId);
    if (balance <= 0) {
      throw new BadRequestException('Cannot delegate without token holdings');
    }

    const endTime = new Date();
    endTime.setDate(endTime.getDate() + delegationDays);

    const delegation = this.delegationRepo.create({
      delegatorId,
      delegatorAddress: `0x${delegatorId}`,
      delegateeId,
      delegateeAddress: `0x${delegateeId}`,
      delegatedBalance: balance,
      isActive: true,
      startTime: new Date(),
      endTime,
    });

    return this.delegationRepo.save(delegation);
  }

  async revokeDelegation(delegationId: string): Promise<VoteDelegation> {
    const delegation = await this.delegationRepo.findOne({ where: { id: delegationId } });
    if (!delegation) {
      throw new BadRequestException('Delegation not found');
    }
    if (!delegation.isActive) {
      throw new BadRequestException('Delegation is already inactive');
    }

    delegation.isActive = false;
    delegation.endTime = new Date();
    return this.delegationRepo.save(delegation);
  }

  async getActiveDelegations(delegatorId: string): Promise<VoteDelegation[]> {
    return this.delegationRepo.find({
      where: { delegatorId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getDelegatorsForUser(delegateeId: string): Promise<VoteDelegation[]> {
    return this.delegationRepo.find({
      where: { delegateeId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }
}

@Injectable()
export class DiscussionService {
  private readonly logger = new Logger(DiscussionService.name);

  constructor(
    @InjectRepository(GovernanceDiscussion)
    private readonly discussionRepo: Repository<GovernanceDiscussion>,
  ) {}

  async addMessage(
    proposalId: string,
    authorId: string,
    authorAddress: string,
    messageType: DiscussionMessageType,
    content: string,
  ): Promise<GovernanceDiscussion> {
    const discussion = this.discussionRepo.create({
      proposalId,
      authorId,
      authorAddress,
      messageType,
      content,
    });

    return this.discussionRepo.save(discussion);
  }

  async getDiscussionThread(proposalId: string): Promise<GovernanceDiscussion[]> {
    return this.discussionRepo.find({
      where: { proposalId },
      order: { createdAt: 'ASC' },
    });
  }
}
