# Multi-Currency Wallet Implementation

This document outlines the changes made to support multi-currency wallets in the SwapTrade backend.

## Overview
The wallet system has been refactored to allow users to hold balances in multiple currencies (Virtual Assets). The system now supports dynamic currency conversion based on asset prices and tracks balances per asset.

## Key Changes

### 1. Database Schema
- **UserBalance Entity**: Replaced the deprecated `Balance` entity.
  - Links `User` and `VirtualAsset`.
  - Stores `balance` as a decimal string.
  - Includes `totalInvested`, `totalPnL`, `averageBuyPrice` for portfolio tracking.
- **VirtualAsset Entity**:
  - Added `price` column (decimal) to support currency conversion.
  - Removed unused `balances` column.

### 2. Services
- **CurrencyService**:
  - Handles currency conversion logic using `VirtualAsset.price`.
  - Provides helper methods to list supported currencies.
- **UserBalanceService**:
  - Manages balance operations (deposit, withdraw, get balance).
  - Ensures atomic updates via transactions where applicable.
- **SwapService**:
  - Updated to use `CurrencyService` for exchange rate calculation.
  - Supports swapping between any two supported assets.
  - Updates `UserBalance` and `Trade` history transactionally.

### 3. API Endpoints
- **Balance Controller** (`/balances`):
  - `GET /balances/currencies`: List supported currencies.
  - `GET /balances/:userId`: Returns all asset balances for a user.
  - `POST /balances/withdraw`: Allows withdrawing a specific amount of an asset.
    - Body: `{ userId: number, assetId: number, amount: number }`
  - `POST /balances/deposit`: Allows depositing a specific amount of an asset.
    - Body: `{ userId: number, assetId: number, amount: number }`
  - `POST /balances/convert`: Helper to calculate conversion rates.
    - Body: `{ amount: number, fromAssetId: number, toAssetId: number }`

- **Swap Controller** (`/swap`):
  - `POST /swap`: Executes a swap between assets.
    - Body: `{ userId: number, fromAssetId: number, toAssetId: number, amount: number }`

### 4. Deprecations
- The old `Balance` entity and `BalanceService` have been removed to avoid conflicts.
- All balance-related operations now go through `UserBalanceService`.

## Usage Examples

### Depositing Funds
```http
POST /balances/deposit
Content-Type: application/json

{
  "userId": 1,
  "assetId": 2,
  "amount": 500.00
}
```

### Withdrawing Funds
```http
POST /balances/withdraw
Content-Type: application/json

{
  "userId": 1,
  "assetId": 2,
  "amount": 100.50
}
```

### Swapping Assets
```http
POST /swap
Content-Type: application/json

{
  "userId": 1,
  "fromAssetId": 1,
  "toAssetId": 2,
  "amount": 50.00
}
```
