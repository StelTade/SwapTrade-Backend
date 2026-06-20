import { AnalyticsExportService } from './analytics-export.service';

describe('AnalyticsExportService', () => {
  const service = new AnalyticsExportService();

  it('should export CSV with expected mime type and non-empty buffer', async () => {
    const analytics = {
      userId: 'u-1',
      riskScore: 10,
      riskLevel: 'LOW',
      annualizedVolatility: 0.1,
      maxDrawdownEstimate: 0.05,
      behavior: {
        anomalyScore: 20,
        unusualTradingPattern: false,
      },
      generatedAt: '2024-01-01T00:00:00.000Z',
    };

    const out = await service.exportAnalytics(analytics, 'csv');
    expect(out.mimeType).toBe('text/csv');
    expect(out.fileName).toMatch(/analytics_u-1_.*\.csv/);
    expect(out.buffer.length).toBeGreaterThan(0);

    const csv = out.buffer.toString('utf8');
    expect(csv).toContain('userId');
    expect(csv).toContain('riskScore');
  });

  it('should export XLSX with expected mime type and non-empty buffer', async () => {
    const analytics = {
      userId: 'u-2',
      riskScore: 90,
      riskLevel: 'CRITICAL',
      annualizedVolatility: 0.5,
      maxDrawdownEstimate: 0.2,
      behavior: {
        anomalyScore: 95,
        unusualTradingPattern: true,
      },
      generatedAt: '2024-01-01T00:00:00.000Z',
    };

    const out = await service.exportAnalytics(analytics, 'xlsx');
    expect(out.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(out.fileName).toMatch(/analytics_u-2_.*\.xlsx/);
    expect(out.buffer.length).toBeGreaterThan(0);
  });
});

