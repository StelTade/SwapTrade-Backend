import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Trade } from '../trading/entities/trade.entity';
import { Balance } from '../balance/balance.entity';
import { BalanceAudit } from '../balance/balance-audit.entity';
import { UserBalance } from '../balance/user-balance.entity';
import { ExportRequestDto, ExportType, ExportFormat } from './dto/export.dto';
import { ExportFormatterService, ExportData } from './services/export-formatter.service';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    @InjectRepository(BalanceAudit)
    private readonly balanceAuditRepository: Repository<BalanceAudit>,
    @InjectRepository(UserBalance)
    private readonly userBalanceRepository: Repository<UserBalance>,
    private readonly formatterService: ExportFormatterService,
  ) {}

  async exportUserData(exportRequest: ExportRequestDto, userId?: string): Promise<{
    filePath: string;
    recordCount: number;
    fileSize: string;
  }> {
    this.logger.log(`Starting export for type: ${exportRequest.type}, format: ${exportRequest.format}`);

    let exportData: ExportData;
    let totalRecords = 0;

    switch (exportRequest.type) {
      case ExportType.TRADES:
        exportData = await this.prepareTradeData(exportRequest, userId);
        break;
      case ExportType.BALANCES:
        exportData = await this.prepareBalanceData(exportRequest, userId);
        break;
      case ExportType.BALANCE_HISTORY:
        exportData = await this.prepareBalanceHistoryData(exportRequest, userId);
        break;
      case ExportType.ALL:
        exportData = await this.prepareAllData(exportRequest, userId);
        break;
      default:
        throw new Error(`Unsupported export type: ${exportRequest.type}`);
    }

    totalRecords = exportData.data.length;
    const filePath = await this.formatterService.formatAndSaveData(exportData, exportRequest.format);
    const fileStats = await this.formatterService.getFileStats(filePath);

    this.logger.log(`Export completed: ${totalRecords} records, file size: ${fileStats.size}`);

    return {
      filePath,
      recordCount: totalRecords,
      fileSize: fileStats.size,
    };
  }

  private async prepareTradeData(exportRequest: ExportRequestDto, userId?: string): Promise<ExportData> {
    const queryBuilder = this.tradeRepository.createQueryBuilder('trade');

    if (userId) {
      queryBuilder.where('trade.userId = :userId', { userId });
    }

    if (exportRequest.fromDate && exportRequest.toDate) {
      queryBuilder.andWhere('trade.timestamp BETWEEN :fromDate AND :toDate', {
        fromDate: new Date(exportRequest.fromDate),
        toDate: new Date(exportRequest.toDate),
      });
    }

    if (exportRequest.assets && exportRequest.assets.length > 0) {
      queryBuilder.andWhere('trade.asset IN (:...assets)', { assets: exportRequest.assets });
    }

    queryBuilder
      .orderBy('trade.timestamp', 'DESC')
      .limit(exportRequest.limit)
      .skip(exportRequest.offset);

    const trades = await queryBuilder.getMany();
    return this.formatterService.formatTradeData(trades);
  }

  private async prepareBalanceData(exportRequest: ExportRequestDto, userId?: string): Promise<ExportData> {
    const queryBuilder = this.balanceRepository.createQueryBuilder('balance');

    if (userId) {
      queryBuilder.where('balance.userId = :userId', { userId });
    }

    if (exportRequest.assets && exportRequest.assets.length > 0) {
      queryBuilder.andWhere('balance.asset IN (:...assets)', { assets: exportRequest.assets });
    }

    queryBuilder
      .orderBy('balance.asset', 'ASC')
      .limit(exportRequest.limit)
      .skip(exportRequest.offset);

    const balances = await queryBuilder.getMany();
    return this.formatterService.formatBalanceData(balances);
  }

  private async prepareBalanceHistoryData(exportRequest: ExportRequestDto, userId?: string): Promise<ExportData> {
    const queryBuilder = this.balanceAuditRepository.createQueryBuilder('audit');

    if (userId) {
      queryBuilder.where('audit.userId = :userId', { userId });
    }

    if (exportRequest.fromDate && exportRequest.toDate) {
      queryBuilder.andWhere('audit.timestamp BETWEEN :fromDate AND :toDate', {
        fromDate: new Date(exportRequest.fromDate),
        toDate: new Date(exportRequest.toDate),
      });
    }

    if (exportRequest.assets && exportRequest.assets.length > 0) {
      queryBuilder.andWhere('audit.asset IN (:...assets)', { assets: exportRequest.assets });
    }

    queryBuilder
      .orderBy('audit.timestamp', 'DESC')
      .limit(exportRequest.limit)
      .skip(exportRequest.offset);

    const balanceHistory = await queryBuilder.getMany();
    return this.formatterService.formatBalanceHistoryData(balanceHistory);
  }

  private async prepareAllData(exportRequest: ExportRequestDto, userId?: string): Promise<ExportData> {
    const tradesData = await this.prepareTradeData(exportRequest, userId);
    const balancesData = await this.prepareBalanceData(exportRequest, userId);
    const balanceHistoryData = await this.prepareBalanceHistoryData(exportRequest, userId);

    // Combine all data with section headers
    const combinedHeaders = ['Section', ...tradesData.headers];
    const combinedData: any[][] = [];

    // Add trades section
    combinedData.push(['TRADES', ...tradesData.headers.map(() => '')]);
    tradesData.data.forEach(row => combinedData.push(['Trade', ...row]));
    combinedData.push(['', ...tradesData.headers.map(() => '')]); // Empty separator

    // Add balances section
    combinedData.push(['BALANCES', ...balancesData.headers.map(() => '')]);
    balancesData.data.forEach(row => combinedData.push(['Balance', ...row]));
    combinedData.push(['', ...balancesData.headers.map(() => '')]); // Empty separator

    // Add balance history section
    combinedData.push(['BALANCE_HISTORY', ...balanceHistoryData.headers.map(() => '')]);
    balanceHistoryData.data.forEach(row => combinedData.push(['History', ...row]));

    return {
      headers: combinedHeaders,
      data: combinedData,
      filename: 'complete_export'
    };
  }

  async getExportPreview(exportRequest: ExportRequestDto, userId?: string): Promise<{
    type: ExportType;
    estimatedRecords: number;
    sampleData: any[];
  }> {
    // Get count of records that would be exported
    let estimatedRecords = 0;
    let sampleData: any[] = [];

    switch (exportRequest.type) {
      case ExportType.TRADES:
        estimatedRecords = await this.getTradeCount(exportRequest, userId);
        sampleData = await this.getTradeSample(exportRequest, 5, userId);
        break;
      case ExportType.BALANCES:
        estimatedRecords = await this.getBalanceCount(exportRequest, userId);
        sampleData = await this.getBalanceSample(exportRequest, 5, userId);
        break;
      case ExportType.BALANCE_HISTORY:
        estimatedRecords = await this.getBalanceHistoryCount(exportRequest, userId);
        sampleData = await this.getBalanceHistorySample(exportRequest, 5, userId);
        break;
      case ExportType.ALL:
        const tradeCount = await this.getTradeCount(exportRequest, userId);
        const balanceCount = await this.getBalanceCount(exportRequest, userId);
        const historyCount = await this.getBalanceHistoryCount(exportRequest, userId);
        estimatedRecords = tradeCount + balanceCount + historyCount;
        
        const tradeSample = await this.getTradeSample(exportRequest, 2, userId);
        const balanceSample = await this.getBalanceSample(exportRequest, 2, userId);
        const historySample = await this.getBalanceHistorySample(exportRequest, 2, userId);
        
        sampleData = [
          { section: 'Trades', data: tradeSample },
          { section: 'Balances', data: balanceSample },
          { section: 'Balance History', data: historySample }
        ];
        break;
    }

    return {
      type: exportRequest.type,
      estimatedRecords,
      sampleData,
    };
  }

  private async getTradeCount(exportRequest: ExportRequestDto, userId?: string): Promise<number> {
    const queryBuilder = this.tradeRepository.createQueryBuilder('trade');
    
    if (userId) queryBuilder.where('trade.userId = :userId', { userId });
    if (exportRequest.fromDate && exportRequest.toDate) {
      queryBuilder.andWhere('trade.timestamp BETWEEN :fromDate AND :toDate', {
        fromDate: new Date(exportRequest.fromDate),
        toDate: new Date(exportRequest.toDate),
      });
    }
    if (exportRequest.assets && exportRequest.assets.length > 0) {
      queryBuilder.andWhere('trade.asset IN (:...assets)', { assets: exportRequest.assets });
    }

    return queryBuilder.getCount();
  }

  private async getBalanceCount(exportRequest: ExportRequestDto, userId?: string): Promise<number> {
    const queryBuilder = this.balanceRepository.createQueryBuilder('balance');
    
    if (userId) queryBuilder.where('balance.userId = :userId', { userId });
    if (exportRequest.assets && exportRequest.assets.length > 0) {
      queryBuilder.andWhere('balance.asset IN (:...assets)', { assets: exportRequest.assets });
    }

    return queryBuilder.getCount();
  }

  private async getBalanceHistoryCount(exportRequest: ExportRequestDto, userId?: string): Promise<number> {
    const queryBuilder = this.balanceAuditRepository.createQueryBuilder('audit');
    
    if (userId) queryBuilder.where('audit.userId = :userId', { userId });
    if (exportRequest.fromDate && exportRequest.toDate) {
      queryBuilder.andWhere('audit.timestamp BETWEEN :fromDate AND :toDate', {
        fromDate: new Date(exportRequest.fromDate),
        toDate: new Date(exportRequest.toDate),
      });
    }
    if (exportRequest.assets && exportRequest.assets.length > 0) {
      queryBuilder.andWhere('audit.asset IN (:...assets)', { assets: exportRequest.assets });
    }

    return queryBuilder.getCount();
  }

  private async getTradeSample(exportRequest: ExportRequestDto, limit: number, userId?: string): Promise<any[]> {
    const queryBuilder = this.tradeRepository.createQueryBuilder('trade');
    
    if (userId) queryBuilder.where('trade.userId = :userId', { userId });
    if (exportRequest.fromDate && exportRequest.toDate) {
      queryBuilder.andWhere('trade.timestamp BETWEEN :fromDate AND :toDate', {
        fromDate: new Date(exportRequest.fromDate),
        toDate: new Date(exportRequest.toDate),
      });
    }
    if (exportRequest.assets && exportRequest.assets.length > 0) {
      queryBuilder.andWhere('trade.asset IN (:...assets)', { assets: exportRequest.assets });
    }

    return queryBuilder
      .orderBy('trade.timestamp', 'DESC')
      .limit(limit)
      .getMany();
  }

  private async getBalanceSample(exportRequest: ExportRequestDto, limit: number, userId?: string): Promise<any[]> {
    const queryBuilder = this.balanceRepository.createQueryBuilder('balance');
    
    if (userId) queryBuilder.where('balance.userId = :userId', { userId });
    if (exportRequest.assets && exportRequest.assets.length > 0) {
      queryBuilder.andWhere('balance.asset IN (:...assets)', { assets: exportRequest.assets });
    }

    return queryBuilder
      .orderBy('balance.asset', 'ASC')
      .limit(limit)
      .getMany();
  }

  private async getBalanceHistorySample(exportRequest: ExportRequestDto, limit: number, userId?: string): Promise<any[]> {
    const queryBuilder = this.balanceAuditRepository.createQueryBuilder('audit');
    
    if (userId) queryBuilder.where('audit.userId = :userId', { userId });
    if (exportRequest.fromDate && exportRequest.toDate) {
      queryBuilder.andWhere('audit.timestamp BETWEEN :fromDate AND :toDate', {
        fromDate: new Date(exportRequest.fromDate),
        toDate: new Date(exportRequest.toDate),
      });
    }
    if (exportRequest.assets && exportRequest.assets.length > 0) {
      queryBuilder.andWhere('audit.asset IN (:...assets)', { assets: exportRequest.assets });
    }

    return queryBuilder
      .orderBy('audit.timestamp', 'DESC')
      .limit(limit)
      .getMany();
  }

  async cleanupOldExports(): Promise<void> {
    await this.formatterService.cleanupOldFiles();
  }
}
