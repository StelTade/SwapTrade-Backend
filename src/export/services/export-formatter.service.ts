import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { createObjectCsvWriter } from 'csv-writer';
import { join } from 'path';
import { promises as fs } from 'fs';
import { ExportFormat } from '../dto/export.dto';

export interface ExportData {
  headers: string[];
  data: any[][];
  filename: string;
}

@Injectable()
export class ExportFormatterService {
  private readonly logger = new Logger(ExportFormatterService.name);
  private readonly exportDir = join(process.cwd(), 'exports');

  constructor() {
    this.ensureExportDirectory();
  }

  private async ensureExportDirectory(): Promise<void> {
    try {
      await fs.access(this.exportDir);
    } catch {
      await fs.mkdir(this.exportDir, { recursive: true });
      this.logger.log(`Created export directory: ${this.exportDir}`);
    }
  }

  async formatAndSaveData(exportData: ExportData, format: ExportFormat): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `${exportData.filename}_${timestamp}`;
    
    switch (format) {
      case ExportFormat.CSV:
        return this.saveAsCsv(exportData, baseFilename);
      case ExportFormat.EXCEL:
        return this.saveAsExcel(exportData, baseFilename);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async saveAsCsv(exportData: ExportData, filename: string): Promise<string> {
    const csvPath = join(this.exportDir, `${filename}.csv`);
    
    const csvWriter = createObjectCsvWriter({
      path: csvPath,
      header: exportData.headers.map(header => ({ id: header, title: header })),
    });

    const records = exportData.data.map(row => {
      const record: any = {};
      exportData.headers.forEach((header, index) => {
        record[header] = row[index];
      });
      return record;
    });

    await csvWriter.writeRecords(records);
    this.logger.log(`CSV export saved: ${csvPath}`);
    
    return csvPath;
  }

  private async saveAsExcel(exportData: ExportData, filename: string): Promise<string> {
    const excelPath = join(this.exportDir, `${filename}.xlsx`);
    
    const worksheetData = [exportData.headers, ...exportData.data];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    
    XLSX.writeFile(workbook, excelPath);
    this.logger.log(`Excel export saved: ${excelPath}`);
    
    return excelPath;
  }

  async getFileStats(filePath: string): Promise<{ size: string; records: number }> {
    const stats = await fs.stat(filePath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    let records = 0;
    if (filePath.endsWith('.csv')) {
      const content = await fs.readFile(filePath, 'utf-8');
      records = content.split('\n').length - 1; // Subtract header row
    } else if (filePath.endsWith('.xlsx')) {
      const workbook = XLSX.readFile(filePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      records = XLSX.utils.sheet_to_json(worksheet).length;
    }
    
    return {
      size: `${sizeInMB} MB`,
      records: Math.max(0, records),
    };
  }

  async cleanupOldFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      const files = await fs.readdir(this.exportDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = join(this.exportDir, file);
        const stats = await fs.stat(filePath);
        const fileAge = now - stats.mtime.getTime();

        if (fileAge > maxAge) {
          await fs.unlink(filePath);
          this.logger.log(`Cleaned up old export file: ${file}`);
        }
      }
    } catch (error) {
      this.logger.error('Error during file cleanup:', error);
    }
  }

  formatTradeData(trades: any[]): ExportData {
    const headers = [
      'ID',
      'User ID',
      'Buyer ID',
      'Seller ID',
      'Asset',
      'Amount',
      'Price',
      'Total Value',
      'Type',
      'Status',
      'Bid ID',
      'Ask ID',
      'Quantity',
      'Timestamp',
      'Metadata'
    ];

    const data = trades.map(trade => [
      trade.id,
      trade.userId,
      trade.buyerId,
      trade.sellerId,
      trade.asset,
      trade.amount,
      trade.price,
      trade.totalValue,
      trade.type,
      trade.status,
      trade.bidId,
      trade.askId,
      trade.quantity,
      trade.timestamp,
      JSON.stringify(trade.metadata || {})
    ]);

    return {
      headers,
      data,
      filename: 'trades'
    };
  }

  formatBalanceData(balances: any[]): ExportData {
    const headers = [
      'ID',
      'User ID',
      'Asset',
      'Balance',
      'Available'
    ];

    const data = balances.map(balance => [
      balance.id,
      balance.userId,
      balance.asset,
      balance.balance,
      balance.available
    ]);

    return {
      headers,
      data,
      filename: 'balances'
    };
  }

  formatBalanceHistoryData(balanceHistory: any[]): ExportData {
    const headers = [
      'ID',
      'User ID',
      'Asset',
      'Old Balance',
      'New Balance',
      'Change Amount',
      'Transaction Type',
      'Reference ID',
      'Timestamp'
    ];

    const data = balanceHistory.map(history => [
      history.id,
      history.userId,
      history.asset,
      history.oldBalance,
      history.newBalance,
      history.changeAmount,
      history.transactionType,
      history.referenceId,
      history.timestamp
    ]);

    return {
      headers,
      data,
      filename: 'balance_history'
    };
  }
}
