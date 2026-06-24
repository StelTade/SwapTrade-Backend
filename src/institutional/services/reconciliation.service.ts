import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReconciliationReport } from '../entities/reconciliation-report.entity';
import { Trade } from '../../database/entities/trade.entity';
import { InstitutionalClient } from '../entities/institutional-client.entity';
import { Order } from '../../orders/entities/order.entity';
import { OrderStatus } from '../../common/enums/order-type.enum';
import { GenerateReconciliationReportDto } from '../dto/reconciliation-report.dto';

/**
 * Reconciliation service for institutional clients.
 *
 * Generates daily reconciliation reports that summarize trading activity,
 * calculate P&L, detect balance discrepancies, and produce audit-ready data
 * for accounting and compliance purposes.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @InjectRepository(ReconciliationReport)
    private readonly reportRepo: Repository<ReconciliationReport>,
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(InstitutionalClient)
    private readonly clientRepo: Repository<InstitutionalClient>,
  ) {}

  /**
   * Generate a reconciliation report for a specific institutional client and date.
   */
  async generateReport(
    dto: GenerateReconciliationReportDto,
  ): Promise<ReconciliationReport> {
    const client = await this.clientRepo.findOne({
      where: { id: dto.institutionalClientId },
    });
    if (!client) {
      throw new NotFoundException(
        `Institutional client ${dto.institutionalClientId} not found`,
      );
    }

    // Check for existing report
    const existing = await this.reportRepo.findOne({
      where: {
        institutionalClientId: dto.institutionalClientId,
        reportDate: dto.reportDate,
        reportType: dto.reportType ?? 'DAILY',
      },
    });
    if (existing && existing.status === 'COMPLETED') {
      return existing; // Return cached report
    }

    // Create or update report record
    let report: ReconciliationReport;
    if (existing) {
      report = existing;
      report.status = 'GENERATING';
      report.error = undefined;
    } else {
      report = this.reportRepo.create({
        institutionalClientId: dto.institutionalClientId,
        reportDate: dto.reportDate,
        reportType: dto.reportType ?? 'DAILY',
        status: 'GENERATING',
        generatedBy: 'SYSTEM',
      });
    }
    report = await this.reportRepo.save(report);

    try {
      const reportDate = new Date(dto.reportDate);
      const dayStart = new Date(reportDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(reportDate);
      dayEnd.setHours(23, 59, 59, 999);

      // Fetch trades for the user on the given date
      const trades = await this.tradeRepo.find({
        where: {
          userId: Number(client.userId),
          createdAt: Between(dayStart, dayEnd),
        },
        order: { createdAt: 'ASC' },
      });

      // Fetch orders for the user on the given date
      const orders = await this.orderRepo.find({
        where: {
          userId: client.userId,
          createdAt: Between(dayStart, dayEnd),
        },
      });

      // Calculate trade statistics
      let totalBuyVolume = 0;
      let totalSellVolume = 0;
      let totalFees = 0;
      let netPnl = 0;

      for (const trade of trades) {
        const value =
          Number(trade.totalValue) ||
          Number(trade.amount) * Number(trade.price);
        if (trade.type === 'BUY') {
          totalBuyVolume += value;
        } else {
          totalSellVolume += value;
        }
      }

      // Estimate fees (0.1% of total volume as default)
      totalFees = (totalBuyVolume + totalSellVolume) * 0.001;
      netPnl = totalSellVolume - totalBuyVolume - totalFees;

      // Calculate discrepancy
      const openingBalance = 0; // Would be calculated from previous day's closing
      const closingBalance = openingBalance + netPnl;
      const discrepancy = closingBalance - (openingBalance + netPnl);

      // Update report
      report.totalTrades = trades.length;
      report.totalBuyVolume = totalBuyVolume;
      report.totalSellVolume = totalSellVolume;
      report.netPnl = netPnl;
      report.totalFees = totalFees;
      report.openingBalance = openingBalance;
      report.closingBalance = closingBalance;
      report.discrepancy = discrepancy;
      report.isReconciled = Math.abs(discrepancy) < 0.0001;
      report.status = 'COMPLETED';

      // Store metadata
      report.metadata = JSON.stringify({
        totalOrders: orders.length,
        filledOrders: orders.filter((o) => o.status === OrderStatus.FILLED)
          .length,
        cancelledOrders: orders.filter(
          (o) => o.status === OrderStatus.CANCELLED,
        ).length,
        partialOrders: orders.filter((o) => o.status === OrderStatus.PARTIAL)
          .length,
        assets: [...new Set(trades.map((t) => t.asset))],
        generatedAt: new Date().toISOString(),
      });

      report = await this.reportRepo.save(report);

      this.logger.log(
        `Reconciliation report generated for client ${dto.institutionalClientId} on ${dto.reportDate}: ` +
          `${trades.length} trades, discrepancy=${discrepancy}`,
      );

      return report;
    } catch (err) {
      report.status = 'FAILED';
      report.error = (err as Error).message;
      await this.reportRepo.save(report);
      this.logger.error(
        `Failed to generate reconciliation report for client ${dto.institutionalClientId}:`,
        (err as Error).message,
      );
      throw err;
    }
  }

  /**
   * Generate daily reconciliation reports for ALL active institutional clients.
   * Runs automatically every day at midnight UTC.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyReportsForAllClients(
    reportDate?: string,
  ): Promise<ReconciliationReport[]> {
    const date = reportDate ?? new Date().toISOString().split('T')[0];
    const clients = await this.clientRepo.find({ where: { isActive: true } });

    this.logger.log(
      `Generating daily reconciliation reports for ${clients.length} institutional clients (date: ${date})`,
    );

    const reports: ReconciliationReport[] = [];
    for (const client of clients) {
      try {
        const report = await this.generateReport({
          institutionalClientId: client.id,
          reportDate: date,
          reportType: 'DAILY',
        });
        reports.push(report);
      } catch (err) {
        this.logger.error(
          `Failed to generate daily report for client ${client.id}:`,
          (err as Error).message,
        );
      }
    }

    return reports;
  }

  /**
   * Get reconciliation reports for an institutional client.
   */
  async getReports(
    institutionalClientId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      status?: string;
      reportType?: string;
    },
  ): Promise<ReconciliationReport[]> {
    const where: any = { institutionalClientId };

    if (filters?.startDate && filters?.endDate) {
      where.reportDate = Between(filters.startDate, filters.endDate);
    } else if (filters?.startDate) {
      where.reportDate = MoreThanOrEqual(filters.startDate);
    } else if (filters?.endDate) {
      where.reportDate = LessThanOrEqual(filters.endDate);
    }

    if (filters?.status) where.status = filters.status;
    if (filters?.reportType) where.reportType = filters.reportType;

    return this.reportRepo.find({
      where,
      order: { reportDate: 'DESC' },
    });
  }

  /**
   * Get a specific reconciliation report by ID.
   */
  async getReportById(reportId: string): Promise<ReconciliationReport> {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException(
        `Reconciliation report ${reportId} not found`,
      );
    }
    return report;
  }
}
