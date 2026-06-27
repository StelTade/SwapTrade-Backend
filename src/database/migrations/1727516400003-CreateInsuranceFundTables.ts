import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateInsuranceFundTables1727516400003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'insurance_fund_tiers',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'tier', type: 'varchar', isUnique: true },
          { name: 'name', type: 'varchar' },
          {
            name: 'minReserve',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'maxExposure',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          { name: 'feeContributionPct', type: 'integer', default: 10 },
          { name: 'isActive', type: 'boolean', default: true },
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
        indices: [
          {
            name: 'IDX_insurance_fund_tiers_tier',
            columnNames: ['tier'],
            isUnique: true,
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'insurance_funds',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'tierId', type: 'integer' },
          { name: 'asset', type: 'varchar' },
          {
            name: 'balance',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'targetReserve',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          { name: 'healthStatus', type: 'varchar', default: "'HEALTHY'" },
          {
            name: 'healthPercent',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 100,
          },
          { name: 'isActive', type: 'boolean', default: true },
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
            columnNames: ['tierId'],
            referencedTableName: 'insurance_fund_tiers',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          { name: 'IDX_insurance_funds_tierId', columnNames: ['tierId'] },
          {
            name: 'IDX_insurance_funds_tier_asset',
            columnNames: ['tierId', 'asset'],
            isUnique: true,
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'insurance_transactions',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'fundId', type: 'integer' },
          { name: 'type', type: 'varchar' },
          {
            name: 'amount',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          {
            name: 'balanceBefore',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          {
            name: 'balanceAfter',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          { name: 'referenceId', type: 'varchar', isNullable: true },
          { name: 'userId', type: 'integer', isNullable: true },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'metadata', type: 'text', isNullable: true },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['fundId'],
            referencedTableName: 'insurance_funds',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_insurance_transactions_fundId',
            columnNames: ['fundId'],
          },
          {
            name: 'IDX_insurance_transactions_referenceId',
            columnNames: ['referenceId'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'liquidation_events',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'userId', type: 'integer' },
          { name: 'positionId', type: 'varchar', isNullable: true },
          {
            name: 'shortfallAmount',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          {
            name: 'coveredAmount',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          { name: 'fundId', type: 'integer', isNullable: true },
          { name: 'cascadePrevented', type: 'boolean', default: false },
          { name: 'status', type: 'varchar', default: "'COMPLETED'" },
          { name: 'notes', type: 'text', isNullable: true },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['fundId'],
            referencedTableName: 'insurance_funds',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
        indices: [
          {
            name: 'IDX_liquidation_events_userId',
            columnNames: ['userId'],
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('liquidation_events');
    await queryRunner.dropTable('insurance_transactions');
    await queryRunner.dropTable('insurance_funds');
    await queryRunner.dropTable('insurance_fund_tiers');
  }
}
