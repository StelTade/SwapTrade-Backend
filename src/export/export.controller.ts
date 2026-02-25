import { Controller, Get, Post, Query, Body, Res, UseGuards, HttpException, HttpStatus, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiProduces } from '@nestjs/swagger';
import type { Response } from 'express';
import { ExportService } from './export.service';
import { ExportRequestDto, ExportQueryDto, ExportResponseDto, ExportType, ExportFormat } from './dto/export.dto';

@ApiTags('Export')
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate and export user data' })
  @ApiResponse({ status: 200, description: 'Export generated successfully', type: ExportResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid export request' })
  async generateExport(@Body() exportRequest: ExportRequestDto): Promise<ExportResponseDto> {
    try {
      const result = await this.exportService.exportUserData(exportRequest);
      
      return {
        success: true,
        message: 'Export generated successfully',
        downloadUrl: `/export/download/${result.filePath.split('/').pop()}`,
        filename: result.filePath.split('/').pop(),
        recordCount: result.recordCount,
        fileSize: result.fileSize,
        exportType: exportRequest.type,
        format: exportRequest.format,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate export: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('preview')
  @ApiOperation({ summary: 'Get export preview with estimated record count and sample data' })
  @ApiResponse({ status: 200, description: 'Export preview generated successfully' })
  async getExportPreview(@Query() query: ExportQueryDto) {
    try {
      const exportRequest: ExportRequestDto = {
        type: query.type || ExportType.TRADES,
        format: query.format || ExportFormat.CSV,
        fromDate: query.fromDate,
        toDate: query.toDate,
        assets: query.assets,
        limit: query.limit,
        offset: query.offset,
      };

      return await this.exportService.getExportPreview(exportRequest);
    } catch (error) {
      throw new HttpException(
        `Failed to generate export preview: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('download/:filename')
  @ApiOperation({ summary: 'Download exported file' })
  @ApiProduces('application/octet-stream')
  @ApiResponse({ status: 200, description: 'File downloaded successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async downloadFile(@Param('filename') filename: string, @Res() res: Response) {
    try {
      const path = require('path');
      const fs = require('fs');
      const filePath = path.join(process.cwd(), 'exports', filename);

      if (!fs.existsSync(filePath)) {
        throw new HttpException('File not found', HttpStatus.NOT_FOUND);
      }

      const stat = fs.statSync(filePath);
      
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to download file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('formats')
  @ApiOperation({ summary: 'Get available export formats' })
  @ApiResponse({ status: 200, description: 'Available export formats' })
  async getExportFormats(): Promise<{ formats: string[] }> {
    return {
      formats: Object.values(ExportFormat),
    };
  }

  @Get('types')
  @ApiOperation({ summary: 'Get available export types' })
  @ApiResponse({ status: 200, description: 'Available export types' })
  async getExportTypes(): Promise<{ types: string[] }> {
    return {
      types: Object.values(ExportType),
    };
  }

  @Get('status/:filename')
  @ApiOperation({ summary: 'Get export file status and metadata' })
  @ApiResponse({ status: 200, description: 'File status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFileStatus(@Param('filename') filename: string) {
    try {
      const path = require('path');
      const fs = require('fs');
      const filePath = path.join(process.cwd(), 'exports', filename);

      if (!fs.existsSync(filePath)) {
        throw new HttpException('File not found', HttpStatus.NOT_FOUND);
      }

      const stat = fs.statSync(filePath);
      
      return {
        filename,
        size: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
        isAvailable: true,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get file status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('cleanup')
  @ApiOperation({ summary: 'Clean up old export files' })
  @ApiResponse({ status: 200, description: 'Cleanup completed successfully' })
  async cleanupOldExports(): Promise<{ message: string; deletedCount?: number }> {
    try {
      await this.exportService.cleanupOldExports();
      return {
        message: 'Cleanup completed successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to cleanup old exports: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
