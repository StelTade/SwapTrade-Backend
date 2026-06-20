import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';


@Injectable()
export class AnalyticsExportService {
  async exportAnalytics(
    analytics: any,
    format: 'csv' | 'xlsx',
  ): Promise<{ mimeType: string; fileName: string; buffer: Buffer }> {
    const safeUserId = String(analytics?.userId ?? 'user');
    const fileNameBase = `analytics_${safeUserId}_${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}`;

    const rows = [
      {
        userId: analytics.userId,
        riskScore: analytics?.riskScore,
        riskLevel: analytics?.riskLevel,
        annualizedVolatility: analytics?.annualizedVolatility,
        maxDrawdownEstimate: analytics?.maxDrawdownEstimate,
        anomalyScore: analytics?.behavior?.anomalyScore,
        unusualTradingPattern: analytics?.behavior?.unusualTradingPattern
          ? 'true'
          : 'false',
        generatedAt: analytics?.generatedAt,
      },
    ];

    if (format === 'csv') {
      const header = Object.keys(rows[0]).join(',');
      const values = Object.values(rows[0]).map((v) => {
        const s = String(v ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      });

      const csv = `${header}\n${values.join(',')}`;

      return {
        mimeType: 'text/csv',
        fileName: `${fileNameBase}.csv`,
        buffer: Buffer.from(csv, 'utf8'),
      };
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'analytics');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `${fileNameBase}.xlsx`,
      buffer,
    };
  }
}

