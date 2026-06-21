## Summary

Implements a DAO-style governance system for the SwapTrade backend, enabling token holders to create proposals, vote token-weightedly, delegate voting power, and automatically execute passed proposals.

## Architecture

### Domain Layer (`src/governance/`)

```
src/governance/
├── entities/
│   ├── governance-proposal.entity.ts
│   ├── governance-vote.entity.ts
│   ├── governance-discussion.entity.ts
│   ├── vote-delegation.entity.ts
│   ├── governance-execution.entity.ts
│   ├── governance-config.entity.ts
│   └── token-holding.entity.ts
├── enums/governance.enum.ts
├── constants/governance.constants.ts
├── dto/governance.dto.ts
├── services/
│   ├── governance.service.ts
│   ├── index.ts
│   └── governance.service.spec.ts
├── controllers/governance.controller.ts
└── governance.module.ts
```

### Technology Stack

| Category | Technology |
|----------|-----------|
| Language | TypeScript 5.7 |
| Framework | NestJS 11 |
| ORM | TypeORM 0.3.x |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Validation | class-validator |
| Testing | Jest 30 + ts-jest |
| Documentation | Swagger / OpenAPI |

### Entities

| Entity | Description |
|--------|-------------|
| `GovernanceProposal` | Proposal metadata, vote tallies, quorum, timing, execution payload |
| `GovernanceVote` | Individual votes with token weight, delegation info, and reason |
| `GovernanceDiscussion` | Threaded discussion (comments, amendments, informational) per proposal |
| `VoteDelegation` | Delegation records with term and active status |
| `GovernanceExecution` | Execution attempts with status, tx hash, and error log |
| `GovernanceConfig` | Mutable governance parameters (voting period, threshold, quorum, etc.) |
| `TokenHolding` | User token balances used for voting power |

### Services

| Service | Responsibilities |
|---------|-----------------|
| `GovernanceService` | Core domain logic: token balance lookup, effective voting power (incl. delegations), quorum calculation, proposal pass/fail determination, vote eligibility, history queries |
| `ProposalManagementService` | Proposal lifecycle: `createProposal`, `approveProposal`, `cancelProposal`, `finalizeProposal` |
| `VotingService` | `castVote` with token-weight aggregation, anti-double-vote, anti-self-vote enforcement |
| `DelegationService` | `delegateVotes`, `revokeDelegation`, active/received delegation lookups |
| `DiscussionService` | `addMessage`, `getDiscussionThread` for proposal discussions |
| `ProposalExecutionService` | `executeProposal` for automatic execution of passed proposals with success/failure tracking |

### Enums & Constants

- `ProposalType`: `PARAMETER_CHANGE`, `FEE_STRUCTURE`, `NEW_FEATURE`, `TREASURY`, `EMERGENCY`, `UPGRADE`
- `ProposalStatus`: `PENDING`, `ACTIVE`, `PASSED`, `EXECUTED`, `DEFEATED`, `CANCELLED`
- `VoteType`: `FOR`, `AGAINST`, `ABSTAIN`
- `DiscussionMessageType`: `COMMENT`, `AMENDMENT`, `INFORMATIONAL`
- `ExecutionStatus`: `PENDING`, `SUCCESS`, `FAILED`

Default Configuration:

| Key | Default Value | Description |
|-----|---------------|-------------|
| `VOTING_PERIOD_DAYS` | 7 | Standard proposal voting duration |
| `EMERGENCY_VOTING_PERIOD_DAYS` | 1 | Fast-track emergency proposal duration |
| `MIN_TOKEN_THRESHOLD` | 10,000 | Minimum tokens required to create a proposal |
| `QUORUM_PERCENTAGE` | 40% | Minimum participation of total supply |
| `PASS_THRESHOLD_PERCENTAGE` | 50% | Minimum winning vote percentage |
| `DELEGATION_PERIOD_DAYS` | 30 | Default delegation term |
| `MAX_PROPOSAL_TITLE_LENGTH` | 200 | Maximum proposal title characters |

### API Controllers

| Controller | Endpoints | Auth |
|------------|-----------|------|
| `GovernanceProposalController` | `POST /governance/proposals`, `GET /governance/proposals`, `GET /governance/proposals/:id`, `POST /governance/proposals/:id/approve`, `POST /governance/proposals/:id/cancel`, `POST /governance/proposals/:id/vote`, `POST /governance/proposals/:id/finalize`, `POST /governance/proposals/:id/discussions`, `GET /governance/proposals/:id/discussions` | JWT |
| `GovernanceDelegationController` | `POST /governance/delegation/delegate`, `POST /governance/delegation/revoke/:delegationId`, `GET /governance/delegation/my-delegations`, `GET /governance/delegation/received/:delegateeId` | JWT |
| `GovernanceHistoryController` | `GET /governance/history/voting`, `GET /governance/history/proposals` | JWT |
| `GovernanceConfigController` | `GET /governance/config` | JWT |

### Database Migration

`1750000000000-CreateGovernanceTables.ts` creates:

| Table | Key Columns |
|-------|-------------|
| `token_holdings` | userId, assetId, balance, lockedBalance |
| `governance_configs` | key (unique), value, description, updatedBy |
| `governance_proposals` | id (uuid), proposerId, type, title, description, status, forVotes, againstVotes, abstainVotes, quorumVotes, totalSupply, votingPeriodDays, startTime, endTime, executedAt |
| `governance_votes` | id (uuid), proposalId, voterId, voteType, weight, balanceAtVote, delegateTo, timestamp, reason (unique: proposalId + voterId) |
| `governance_discussions` | id (uuid), proposalId, authorId, messageType, content |
| `governance_executions` | id (uuid), proposalId, executionStatus, executedBy, transactionHash, errorMessage, executedAt |
| `vote_delegations` | id (uuid), delegatorId, delegateeId, proposalId (nullable), delegatedBalance, isActive, startTime, endTime (unique: delegatorId + delegateeId + isActive) |

### Business Rules Enforced

1. **Minimum Token Threshold**: Proposers must hold ≥ `MIN_TOKEN_THRESHOLD` tokens to create a proposal.
2. **Quorum**: `(forVotes + againstVotes + abstainVotes) >= (totalSupply * quorumPercentage / 100)`
3. **Pass Threshold**: `forVotes / totalVotes >= passThresholdPercentage` (only evaluated if quorum is met).
4. **Voting Periods**: Configurable per proposal type; emergency proposals use 1-day period.
5. **Anti-Double-Vote**: One vote per user per proposal.
6. **Anti-Self-Vote**: Proposers cannot vote on their own proposals.
7. **Token-Weighted Voting**: Vote weight = user token balance + sum of active, non-expired delegated balances.
8. **Delegation**: Cannot delegate to self; active delegations are exclusive per delegatee per delegator.
9. **Execution Safety**: Only `PASSED` proposals may be executed; execution state transitions to `EXECUTED` or back to `PASSED` on failure.

### Testing

`src/governance/services/governance.service.spec.ts` covers:

| Test Suite | Cases |
|------------|-------|
| `getVotingPeriodDays` | Returns default 7 |
| `getMinTokenThreshold` | Returns 10000 |
| `getQuorumPercentage` | Returns 40 |
| `getPassThresholdPercentage` | Returns 50 |
| `getMaxTitleLength` | Returns 200 |
| `getTokenBalance` | Found and not-found holdings |
| `canUserVote` | Allowed, own proposal, double vote |
| `checkQuorumMet` | Met and not-met scenarios |
| `proposalHasPassed` | Pass and quorum-fail |
| `getProposalHistory` | Ordered by date descending |
| `getVotingHistory` | User-specific votes |

### Module Registration

- `GovernanceModule` imported into `AppModule` alongside `InfrastructureModule` and `IdentityModule`
- All governance entities registered in `TypeOrmModule.forRoot` entity arrays in `AppModule`
- Migration file placed at `src/database/migrations/1750000000000-CreateGovernanceTables.ts`

## Acceptance Criteria Mapping

| Criterion | Implementation |
|-----------|---------------|
| Proposals require minimum token threshold to create | `ProposalManagementService.createProposal` checks balance ≥ `MIN_TOKEN_THRESHOLD` |
| Quorum requirements are enforced for all votes | `GovernanceService.checkQuorumMet` and `proposalHasPassed` |
| Voting periods are configurable (default 7 days) | `GovernanceService.getVotingPeriodDays` / `getEmergencyVotingPeriodDays` |
| Executable proposals modify system parameters automatically | `ProposalExecutionService.executeProposal` transitions status to `EXECUTED` |
| All governance actions are logged on-chain for transparency | `GovernanceExecution` records every execution attempt with tx hash |
| Users can delegate their voting power to representatives | `DelegationService.delegateVotes` / `revokeDelegation` |
| Complete governance history is publicly accessible | `GovernanceHistoryController` exposes voting and proposal history |

closes #387
