#!/usr/bin/env node

// Simple test to demonstrate balance history functionality
const express = require('express');
const { DataSource } = require('typeorm');

// Mock database setup
const AppDataSource = new DataSource({
  type: 'sqlite',
  database: ':memory:',
  entities: [
    require('./src/balance/balance-audit.entity'),
    require('./src/balance/balance.entity'),
  ],
  synchronize: true,
  logging: false,
});

const app = express();
app.use(express.json());

// Mock balance history data
const mockBalanceHistory = [
  {
    id: 1,
    userId: '1',
    asset: 'BTC',
    amountChanged: 0.5,
    resultingBalance: 1.5,
    reason: 'TRADE_EXECUTED',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    transactionId: 'tx_123',
    relatedOrderId: 'order_456',
    previousBalance: 1.0,
  },
  {
    id: 2,
    userId: '1',
    asset: 'ETH',
    amountChanged: -0.2,
    resultingBalance: 2.8,
    reason: 'BALANCE_WITHDRAWAL',
    timestamp: new Date('2024-01-14T15:45:00Z'),
    transactionId: 'tx_124',
    previousBalance: 3.0,
  },
  {
    id: 3,
    userId: '1',
    asset: 'BTC',
    amountChanged: 1.0,
    resultingBalance: 2.5,
    reason: 'BALANCE_DEPOSIT',
    timestamp: new Date('2024-01-13T09:20:00Z'),
    transactionId: 'tx_125',
    previousBalance: 1.5,
  }
];

// Balance history endpoint
app.get('/balances/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, asset, limit = 50, offset = 0 } = req.query;

    console.log(`Balance history request for user: ${userId}`);
    console.log('Query params:', { startDate, endDate, asset, limit, offset });

    // Simulate filtering
    let filteredHistory = mockBalanceHistory.filter(entry => entry.userId === userId);

    if (asset) {
      filteredHistory = filteredHistory.filter(entry => entry.asset === asset);
    }

    if (startDate) {
      const start = new Date(startDate);
      filteredHistory = filteredHistory.filter(entry => new Date(entry.timestamp) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      filteredHistory = filteredHistory.filter(entry => new Date(entry.timestamp) <= end);
    }

    // Sort by timestamp descending
    filteredHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    const total = filteredHistory.length;
    const paginatedData = filteredHistory.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    const hasMore = parseInt(offset) + parseInt(limit) < total;

    const response = {
      data: paginatedData.map(entry => ({
        asset: entry.asset,
        amountChanged: entry.amountChanged,
        reason: entry.reason,
        timestamp: entry.timestamp.toISOString(),
        resultingBalance: entry.resultingBalance,
        transactionId: entry.transactionId,
        relatedOrderId: entry.relatedOrderId,
      })),
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore,
    };

    res.json(response);
  } catch (error) {
    console.error('Balance history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET /health - Health check');
  console.log('  GET /balances/history/:userId - Balance history');
  console.log('');
  console.log('Example requests:');
  console.log(`  curl http://localhost:${PORT}/balances/history/1`);
  console.log(`  curl "http://localhost:${PORT}/balances/history/1?asset=BTC&limit=10"`);
  console.log(`  curl "http://localhost:${PORT}/balances/history/1?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z"`);
});
