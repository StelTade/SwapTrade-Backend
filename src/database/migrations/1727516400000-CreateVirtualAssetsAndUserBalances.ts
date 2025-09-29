import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateVirtualAssetsAndUserBalances1727516400000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create virtual_assets table
    await queryRunner.createTable(
      new Table({
        name: 'virtual_assets',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'symbol',
            type: 'varchar',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
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
            name: 'IDX_virtual_assets_symbol',
            columnNames: ['symbol'],
            isUnique: true,
          },
        ],
      }),
    );

    // Create user_balances table
    await queryRunner.createTable(
      new Table({
        name: 'user_balances',
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
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'assetId',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'balance',
            type: 'decimal',
            precision: 15,
            scale: 8,
            default: 0,
          },
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
            columnNames: ['userId'],
            referencedTableName: 'user',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['assetId'],
            referencedTableName: 'virtual_assets',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_user_balances_userId',
            columnNames: ['userId'],
          },
          {
            name: 'IDX_user_balances_assetId',
            columnNames: ['assetId'],
          },
          {
            name: 'IDX_user_balances_userId_assetId',
            columnNames: ['userId', 'assetId'],
            isUnique: true,
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop user_balances table (this will also drop its indexes and foreign keys)
    await queryRunner.dropTable('user_balances');

    // Drop virtual_assets table (this will also drop its indexes)
    await queryRunner.dropTable('virtual_assets');
  }
}
