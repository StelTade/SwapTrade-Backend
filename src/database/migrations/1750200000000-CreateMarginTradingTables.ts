import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateMarginTradingTables1750200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'margin_pair_configs',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'baseAssetId', type: 'integer' },
          { name: 'quoteAssetId', type: 'integer' },
          {
            name: 'maxLeverage',
            type: 'decimal',
            precision: 8,
            scale: 2,
            default: 10,
          },
          {
            name: 'initialMarginRate',
            type: 'decimal',
            precision: 8,
            scale: 6,
            default: 0.1,
          },
          {
            name: 'maintenanceMarginRate',
            type: 'decimal',
            precision: 8,
            scale: 6,
            default: 0.05,
          },
          { name: 'dailyInterestRateBps', type: 'integer', default: 10 },
          {
            name: 'volatilityPct',
            type: 'decimal',
            precision: 8,
            scale: 4,
            default: 50,
          },
          {
            name: 'volatilityLeverageFactor',
            type: 'decimal',
            precision: 8,
            scale: 4,
            default: 2,
          },
          {
            name: 'marginCallThresholdRatio',
            type: 'decimal',
            precision: 8,
            scale: 4,
            default: 1.15,
          },
          { name: 'isEnabled', type: 'boolean', default: true },
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
      }),
    );

    await queryRunner.createIndex(
      'margin_pair_configs',
      new TableIndex({
        name: 'IDX_margin_pair_configs_base_quote',
        columnNames: ['baseAssetId', 'quoteAssetId'],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'margin_positions',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'userId', type: 'integer' },
          { name: 'pairConfigId', type: 'integer' },
          { name: 'side', type: 'varchar' },
          {
            name: 'size',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          {
            name: 'entryPrice',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          {
            name: 'leverage',
            type: 'decimal',
            precision: 8,
            scale: 2,
          },
          {
            name: 'collateral',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          {
            name: 'borrowedAmount',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'liquidationPrice',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          {
            name: 'unrealizedPnl',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'accruedInterest',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          { name: 'status', type: 'varchar', default: "'OPEN'" },
          { name: 'marginCallNotifiedAt', type: 'datetime', isNullable: true },
          { name: 'lastInterestAccrualAt', type: 'datetime', isNullable: true },
          {
            name: 'openedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          { name: 'closedAt', type: 'datetime', isNullable: true },
          { name: 'liquidatedAt', type: 'datetime', isNullable: true },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'margin_positions',
      new TableIndex({
        name: 'IDX_margin_positions_user_status',
        columnNames: ['userId', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'margin_positions',
      new TableIndex({
        name: 'IDX_margin_positions_pair_status',
        columnNames: ['pairConfigId', 'status'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'margin_interest_accruals',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'positionId', type: 'varchar' },
          { name: 'userId', type: 'integer' },
          {
            name: 'borrowedAmount',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          {
            name: 'interestAmount',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          { name: 'dailyInterestRateBps', type: 'integer' },
          {
            name: 'accruedTotalAfter',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          { name: 'accrualDate', type: 'date' },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'margin_interest_accruals',
      new TableIndex({
        name: 'IDX_margin_interest_position_date',
        columnNames: ['positionId', 'accrualDate'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('margin_interest_accruals');
    await queryRunner.dropTable('margin_positions');
    await queryRunner.dropTable('margin_pair_configs');
  }
}
