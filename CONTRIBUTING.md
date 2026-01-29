# Contributing

## Database Migrations

This project uses TypeORM migrations to manage schema changes. Follow the steps below to create, verify, and run migrations.

### Creating a migration

1. Generate a migration:

```bash
npm run migration:generate -- -n <MigrationName>
```

2. Verify the generated migration file appears in `src/database/migrations/` and contains the intended SQL changes.

### Verifying migrations

Run the verification script to check for pending migrations without applying them:

```bash
npm run migration:verify
```

Expected output:

- `✅ No pending migrations` when up-to-date
- `⚠️ Pending migrations detected` and a non-zero exit code when pending migrations are found

If pending migrations are detected, review and apply them with:

```bash
npm run migration:run
```

### Pre-migration checks

Before applying migrations in production or staging:

- Ensure you have a backup of your database.
- Ensure the migration file has both `up` and `down` implementations (for rollback).
- Run `npm run migration:verify` locally and in CI as a PR gate.

### Logging & Troubleshooting

- The application runs a migration validation check during startup and logs whether there are pending migrations.
- Migration scripts should avoid using ES module features directly that cause runtime warnings when executed via `ts-node` or TypeORM CLI. If you see "ES module" related warnings, ensure the migration files use CommonJS-compatible imports/exports or are run with a TypeScript runner that supports ESM.

### CI Recommendations

- Add a pipeline step that runs `npm run migration:verify` to prevent PRs that introduce missed migrations.

---

Thanks for contributing! Please follow code style conventions and add tests when applicable.
