import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLockedBalanceToUserBalances1750000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'user_balances',
      new TableColumn({
        name: 'lockedBalance',
        type: 'decimal',
        precision: 15,
        scale: 8,
        default: 0,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('user_balances', 'lockedBalance');
  }
}
