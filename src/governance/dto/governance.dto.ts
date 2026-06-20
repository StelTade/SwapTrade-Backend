import { IsEnum, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { ProposalType } from '../enums/governance.enum';

export class CreateProposalDto {
  @IsEnum(ProposalType)
  type: ProposalType;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  parameters?: Record<string, any>;
}

export class CastVoteDto {
  @IsEnum(['FOR', 'AGAINST', 'ABSTAIN'])
  voteType: string;

  @IsOptional()
  reason?: string;
}

export class AddDiscussionDto {
  @IsEnum(['COMMENT', 'AMENDMENT', 'INFORMATIONAL'])
  messageType: string;

  @IsString()
  content: string;
}

export class UpdateGovernanceConfigDto {
  @IsNumber()
  @Min(0)
  value: number;
}

export class ExecutionResultDto {
  proposalId: string;
  executionStatus: string;
  transactionHash?: string;
  executedAt: Date;
}
