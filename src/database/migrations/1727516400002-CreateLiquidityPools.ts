import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateLiquidityPools1727516400002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'liquidity_pools',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'tokenAId', type: 'integer', isNullable: false },
          { name: 'tokenBId', type: 'integer', isNullable: false },
          { name: 'chainId', type: 'varchar', isNullable: false },
          {
            name: 'reserveA',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'reserveB',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'totalLpSupply',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          { name: 'feeBps', type: 'integer', default: 30 },
          { name: 'status', type: 'varchar', default: "'ACTIVE'" },
          {
            name: 'accumulatedFeesA',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'accumulatedFeesB',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'totalVolume',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          { name: 'totalSwaps', type: 'integer', default: 0 },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['tokenAId'],
            referencedTableName: 'virtual_assets',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['tokenBId'],
            referencedTableName: 'virtual_assets',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_liquidity_pools_tokenAId',
            columnNames: ['tokenAId'],
          },
          {
            name: 'IDX_liquidity_pools_tokenBId',
            columnNames: ['tokenBId'],
          },
          {
            name: 'IDX_liquidity_pools_chainId',
            columnNames: ['chainId'],
          },
          {
            name: 'IDX_liquidity_pools_pair_chain',
            columnNames: ['tokenAId', 'tokenBId', 'chainId'],
            isUnique: true,
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'pool_positions',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'poolId', type: 'integer', isNullable: false },
          { name: 'userId', type: 'integer', isNullable: false },
          {
            name: 'lpAmount',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'depositedAmountA',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'depositedAmountB',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'feesEarnedA',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'feesEarnedB',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          { name: 'depositedAt', type: 'datetime', isNullable: true },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['poolId'],
            referencedTableName: 'liquidity_pools',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          { name: 'IDX_pool_positions_poolId', columnNames: ['poolId'] },
          { name: 'IDX_pool_positions_userId', columnNames: ['userId'] },
          {
            name: 'IDX_pool_positions_pool_user',
            columnNames: ['poolId', 'userId'],
            isUnique: true,
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'pool_swaps',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'poolId', type: 'integer', isNullable: false },
          { name: 'userId', type: 'integer', isNullable: false },
          { name: 'tokenIn', type: 'varchar', isNullable: false },
          { name: 'tokenOut', type: 'varchar', isNullable: false },
          {
            name: 'amountIn',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: false,
          },
          {
            name: 'amountOut',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: false,
          },
          {
            name: 'feePaid',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'priceImpact',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          { name: 'status', type: 'varchar', default: "'COMPLETED'" },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['poolId'],
            referencedTableName: 'liquidity_pools',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          { name: 'IDX_pool_swaps_poolId', columnNames: ['poolId'] },
          { name: 'IDX_pool_swaps_userId', columnNames: ['userId'] },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'emergency_withdrawals',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'poolId', type: 'integer', isNullable: false },
          { name: 'userId', type: 'integer', isNullable: false },
          {
            name: 'lpAmountBurned',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: false,
          },
          {
            name: 'amountA',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: false,
          },
          {
            name: 'amountB',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: false,
          },
          { name: 'reason', type: 'varchar', isNullable: false },
          { name: 'status', type: 'varchar', default: "'PENDING'" },
          { name: 'adminApprovedBy', type: 'integer', isNullable: true },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['poolId'],
            referencedTableName: 'liquidity_pools',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_emergency_withdrawals_poolId',
            columnNames: ['poolId'],
          },
          {
            name: 'IDX_emergency_withdrawals_userId',
            columnNames: ['userId'],
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('emergency_withdrawals');
    await queryRunner.dropTable('pool_swaps');
    await queryRunner.dropTable('pool_positions');
    await queryRunner.dropTable('liquidity_pools');
  }
}
