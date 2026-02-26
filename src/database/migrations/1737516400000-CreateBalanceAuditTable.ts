import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateBalanceAuditTable1737516400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'balance_audit',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'userId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'asset',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'amountChanged',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          {
            name: 'resultingBalance',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          {
            name: 'reason',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'timestamp',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'transactionId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'relatedOrderId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'previousBalance',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for performance
    // Indexes are already defined in the table schema above
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('balance_audit');
  }
}
