import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateGovernanceTables1750000000000 implements MigrationInterface {
  name = 'CreateGovernanceTables1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'token_holdings',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'userId', type: 'varchar' },
          { name: 'assetId', type: 'integer' },
          {
            name: 'balance',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'lockedBalance',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          { name: 'lastUpdated', type: 'timestamp' },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'token_holdings',
      new TableIndex({
        name: 'IDX_token_holdings_userId',
        columnNames: ['userId'],
      }),
    );
    await queryRunner.createIndex(
      'token_holdings',
      new TableIndex({
        name: 'IDX_token_holdings_userId_assetId',
        columnNames: ['userId', 'assetId'],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'governance_configs',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'key', type: 'varchar', isUnique: true },
          { name: 'value', type: 'decimal', precision: 18, scale: 8 },
          { name: 'description', type: 'varchar' },
          { name: 'updatedBy', type: 'varchar' },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'governance_proposals',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'proposerId', type: 'varchar' },
          { name: 'proposerAddress', type: 'varchar' },
          { name: 'type', type: 'varchar' },
          { name: 'title', type: 'varchar', length: '500' },
          { name: 'description', type: 'text' },
          { name: 'parameters', type: 'json' },
          { name: 'executionPayload', type: 'json', isNullable: true },
          { name: 'status', type: 'varchar', length: '20' },
          {
            name: 'forVotes',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'againstVotes',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'abstainVotes',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'quorumVotes',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 40,
          },
          {
            name: 'totalSupply',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          { name: 'votingPeriodDays', type: 'integer' },
          { name: 'startTime', type: 'timestamp' },
          { name: 'endTime', type: 'timestamp' },
          { name: 'executedAt', type: 'timestamp', isNullable: true },
          { name: 'cancellationReason', type: 'varchar', isNullable: true },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'governance_proposals',
      new TableIndex({
        name: 'IDX_proposals_status_startTime',
        columnNames: ['status', 'startTime'],
      }),
    );
    await queryRunner.createIndex(
      'governance_proposals',
      new TableIndex({
        name: 'IDX_proposals_proposerId',
        columnNames: ['proposerId'],
      }),
    );
    await queryRunner.createIndex(
      'governance_proposals',
      new TableIndex({ name: 'IDX_proposals_id', columnNames: ['id'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'governance_votes',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'proposalId', type: 'uuid' },
          { name: 'voterId', type: 'varchar' },
          { name: 'voterAddress', type: 'varchar' },
          { name: 'voteType', type: 'varchar', length: '10' },
          {
            name: 'weight',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'balanceAtVote',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          { name: 'delegateTo', type: 'varchar', isNullable: true },
          { name: 'timestamp', type: 'timestamp' },
          { name: 'reason', type: 'text', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'governance_votes',
      new TableIndex({
        name: 'IDX_votes_proposal_voter',
        columnNames: ['proposalId', 'voterId'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'governance_votes',
      new TableIndex({
        name: 'IDX_votes_proposalId',
        columnNames: ['proposalId'],
      }),
    );
    await queryRunner.createIndex(
      'governance_votes',
      new TableIndex({ name: 'IDX_votes_voterId', columnNames: ['voterId'] }),
    );
    await queryRunner.createIndex(
      'governance_votes',
      new TableIndex({ name: 'IDX_votes_id', columnNames: ['id'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'governance_discussions',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'proposalId', type: 'uuid' },
          { name: 'authorId', type: 'varchar' },
          { name: 'authorAddress', type: 'varchar' },
          { name: 'messageType', type: 'varchar', length: '20' },
          { name: 'content', type: 'text' },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'governance_discussions',
      new TableIndex({
        name: 'IDX_discussions_proposalId',
        columnNames: ['proposalId'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'governance_executions',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'proposalId', type: 'uuid' },
          { name: 'executionStatus', type: 'varchar', length: '20' },
          { name: 'executedBy', type: 'json' },
          { name: 'transactionHash', type: 'varchar', isNullable: true },
          { name: 'errorMessage', type: 'text', isNullable: true },
          { name: 'executedAt', type: 'timestamp' },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'governance_executions',
      new TableIndex({
        name: 'IDX_executions_proposalId',
        columnNames: ['proposalId'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'vote_delegations',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'delegatorId', type: 'varchar' },
          { name: 'delegatorAddress', type: 'varchar' },
          { name: 'delegateeId', type: 'varchar' },
          { name: 'delegateeAddress', type: 'varchar' },
          { name: 'proposalId', type: 'varchar', isNullable: true },
          {
            name: 'delegatedBalance',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          { name: 'isActive', type: 'boolean', default: true },
          { name: 'startTime', type: 'timestamp' },
          { name: 'endTime', type: 'timestamp', isNullable: true },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'vote_delegations',
      new TableIndex({
        name: 'IDX_delegations_delegator_delegatee',
        columnNames: ['delegatorId', 'delegateeId', 'isActive'],
      }),
    );
    await queryRunner.createIndex(
      'vote_delegations',
      new TableIndex({
        name: 'IDX_delegations_delegatorId',
        columnNames: ['delegatorId'],
      }),
    );
    await queryRunner.createIndex(
      'vote_delegations',
      new TableIndex({
        name: 'IDX_delegations_delegateeId',
        columnNames: ['delegateeId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('vote_delegations');
    await queryRunner.dropTable('governance_executions');
    await queryRunner.dropTable('governance_discussions');
    await queryRunner.dropTable('governance_votes');
    await queryRunner.dropTable('governance_proposals');
    await queryRunner.dropTable('governance_configs');
    await queryRunner.dropTable('token_holdings');
  }
}
