# Production Database Migration Strategy

## Overview
This document outlines the strategy for managing database schema changes in the SwapTrade backend. Our goal is to ensure **zero-downtime deployments**, **data integrity**, and **safe rollbacks**.

## Core Principles
1.  **Non-Destructive Changes**: Never drop columns or tables that are currently in use.
2.  **Expand and Contract**: Use the Expand-Contract pattern for breaking changes.
3.  **Validation**: Every migration must verify its own success.
4.  **Rollback Tested**: Every migration must have a tested `down` method.

## The `SafeMigration` Pattern
All migrations must extend the `SafeMigration` class. This enforces the implementation of:
- `performUp(queryRunner)`: The actual schema change.
- `performDown(queryRunner)`: The rollback logic.
- `validateUp(queryRunner)`: Logic to verify the migration succeeded (e.g., check row counts, verify constraints).
- `validateDown(queryRunner)`: Logic to verify the rollback succeeded.

### Example
```typescript
export class AddUserStatus1234567890 extends SafeMigration {
  protected async performUp(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "status" varchar NOT NULL DEFAULT 'active'`);
  }

  protected async validateUp(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('user', 'status');
    if (!hasColumn) throw new Error('Column status was not added');
  }

  protected async performDown(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "status"`);
  }

  protected async validateDown(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('user', 'status');
    if (hasColumn) throw new Error('Column status was not removed');
  }
}
```

## Zero-Downtime Strategies

### 1. Adding a Column
- **Safe**: Add column with `NULL` or `DEFAULT` value.
- **Action**: Deploy code that uses the new column.

### 2. Renaming a Column (Expand-Contract)
1.  **Phase 1 (Expand)**:
    - Add new column `new_name`.
    - Deploy code that writes to BOTH `old_name` and `new_name`, but reads from `old_name`.
    - Backfill data from `old_name` to `new_name`.
2.  **Phase 2 (Migrate Read)**:
    - Deploy code that reads from `new_name`.
3.  **Phase 3 (Contract)**:
    - Remove `old_name` column (after verifying no access logs point to it).

### 3. Changing Column Type
- Create a new column with the desired type.
- Dual-write to both columns.
- Backfill data.
- Switch reads to the new column.
- Drop the old column.

## Shadow Tables for Large Migrations
For extremely large tables where `ALTER TABLE` locks the database:
1.  Create a "Shadow Table" with the new schema.
2.  Create triggers on the original table to replicate changes to the shadow table.
3.  Backfill data in batches.
4.  Once synced, switch application to use the shadow table.
5.  Drop original table.

## Verification & CI/CD

### Pre-Deployment
- `npm run migration:verify`: Checks if the database is in sync with the codebase.
- CI pipeline runs migrations on a staging database and executes `validateUp`.
- CI pipeline executes `down` and `validateDown` to ensure rollback works.

### Deployment
1.  **Backup**: Automated snapshot of the database.
2.  **Migrate**: Run `typeorm migration:run`.
3.  **Health Check**: Verify application health.
4.  **Rollback (if needed)**: Run `typeorm migration:revert`.

## Rollback Procedures

### Automated Rollback
If `performUp` or `validateUp` fails, the transaction is automatically rolled back by the database (for transactional DDL).

### Manual Rollback
If an issue is discovered after deployment:
1.  Run `npm run migration:revert` to undo the last migration.
2.  The `SafeMigration` class will execute `performDown` followed by `validateDown`.

## Monitoring
Use the Migration Dashboard (via `MigrationMonitorService`) to track:
- Pending migrations count.
- Last execution time.
- Sync status.

## Disaster Recovery
In case of catastrophic corruption:
1.  Restore from the pre-migration snapshot.
2.  Replay missing transactions if Point-in-Time Recovery (PITR) is enabled.

---
*Generated for SwapTrade Backend*