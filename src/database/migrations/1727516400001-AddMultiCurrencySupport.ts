import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMultiCurrencySupport1727516400001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add price to virtual_assets
    await queryRunner.addColumn(
      'virtual_assets',
      new TableColumn({
        name: 'price',
        type: 'decimal',
        precision: 18,
        scale: 8,
        default: 0,
      }),
    );

    // Add portfolio fields to user_balances
    await queryRunner.addColumns('user_balances', [
      new TableColumn({
        name: 'totalTrades',
        type: 'int',
        default: 0,
      }),
      new TableColumn({
        name: 'cumulativePnL',
        type: 'decimal',
        precision: 18,
        scale: 8,
        default: 0,
      }),
      new TableColumn({
        name: 'totalTradeVolume',
        type: 'decimal',
        precision: 18,
        scale: 8,
        default: 0,
      }),
      new TableColumn({
        name: 'lastTradeDate',
        type: 'datetime', // Use datetime for SQLite compatibility (timestamp works too usually but datetime is safer across DBs)
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('virtual_assets', 'price');
    await queryRunner.dropColumns('user_balances', [
      'totalTrades',
      'cumulativePnL',
      'totalTradeVolume',
      'lastTradeDate',
    ]);
  }
}
