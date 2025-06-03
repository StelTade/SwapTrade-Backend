# SwapTrade Data Seeding Framework

## Overview

This module provides a comprehensive data seeding framework for the SwapTrade backend application. It supports both development and testing environments with different seeding strategies.

## Features

- **Environment-specific seeding**: Different data sets for development and testing environments
- **Factory pattern**: Flexible and reusable data generation
- **Modular architecture**: Easy to extend with new entity seeders
- **Command-line interface**: Simple commands to seed or clear data

## Usage

### Seeding Data

To seed your database with initial data:

```bash
npm run seed
```

This will populate your database with:
- User accounts (including an admin user)
- Other essential entities

### Clearing Seeded Data

To clear all seeded data from the database:

```bash
npm run seed:clear
```

## Architecture

### Directory Structure

```
src/database/seeds/
├── factories/          # Entity factories for generating test data
│   ├── base.factory.ts # Base factory class
│   └── user.factory.ts # User entity factory
├── main.seeder.ts      # Main seeder orchestration
├── seed.ts             # CLI entry point
├── seeder.interface.ts # Interface for all seeders
├── seeder.module.ts    # NestJS module for seeders
└── user.seeder.ts      # User entity seeder
```

### Adding New Seeders

1. Create a new factory in the `factories` directory
2. Create a new seeder that implements the `Seeder` interface
3. Register the seeder in the `SeederModule`
4. Add the seeder to the `MainSeeder` constructor and seed method

## Environment Configuration

The seeding framework uses the `NODE_ENV` environment variable to determine which environment to seed for. Set this variable before running the seed command:

```bash
# For development environment
NODE_ENV=development npm run seed

# For test environment
NODE_ENV=test npm run seed
```

## Best Practices

- Use factories to generate test data instead of hardcoding values
- Keep seed data minimal but sufficient for testing
- Use environment-specific seeding for different data requirements
- Clear data before seeding to avoid duplicates
