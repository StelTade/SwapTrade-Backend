# Data Export Functionality Documentation

## Overview

The Data Export system allows users to export their historical trading and balance data in CSV and Excel formats with comprehensive filtering, pagination, and data validation capabilities.

## Architecture

### Components

1. **Export Service** (`src/export/export.service.ts`)
   - Orchestrates data export operations
   - Handles data filtering and pagination
   - Manages export preview functionality

2. **Export Formatter Service** (`src/export/services/export-formatter.service.ts`)
   - Formats data for CSV and Excel output
   - Manages file operations and cleanup
   - Handles file statistics and metadata

3. **Export Controller** (`src/export/export.controller.ts`)
   - REST API endpoints for export operations
   - File download management
   - Export status monitoring

## Features

### Export Types

1. **Trades Export**
   - All user trading history
   - Includes trade details, timestamps, and metadata
   - Filterable by asset, date range, and status

2. **Balances Export**
   - Current user balances across all assets
   - Available and total balance information
   - Filterable by specific assets

3. **Balance History Export**
   - Historical balance changes and transactions
   - Audit trail for all balance modifications
   - Transaction types and reference IDs

4. **Complete Export**
   - Combined export of all data types
   - Organized in sections within single file
   - Comprehensive user data snapshot

### Export Formats

1. **CSV Format**
   - Comma-separated values
   - Compatible with spreadsheet applications
   - Lightweight and universally supported

2. **Excel Format**
   - XLSX format with advanced formatting
   - Multiple sheets for different data types
   - Enhanced data presentation

### Data Filtering

- **Date Range Filtering**: Export data within specific time periods
- **Asset Filtering**: Export data for selected assets only
- **Pagination**: Handle large datasets with configurable limits
- **Record Limits**: Control export size for performance

### Export Preview

- **Record Count Estimation**: Preview number of records before export
- **Sample Data**: View sample records to verify export content
- **Format Validation**: Ensure export parameters are correct

## API Endpoints

### POST /export/generate
Generate and export user data
- Body: `ExportRequestDto`
- Response: `ExportResponseDto` with download URL

### GET /export/preview
Get export preview with estimated record count and sample data
- Query Parameters: `ExportQueryDto`
- Response: Preview with record count and sample data

### GET /export/download/:filename
Download exported file
- Path Parameter: `filename`
- Response: File download with appropriate headers

### GET /export/formats
Get available export formats
- Response: List of supported formats (CSV, Excel)

### GET /export/types
Get available export types
- Response: List of export types (trades, balances, balance_history, all)

### GET /export/status/:filename
Get export file status and metadata
- Path Parameter: `filename`
- Response: File information (size, creation date, availability)

### POST /export/cleanup
Clean up old export files
- Response: Cleanup completion status

## Data Models

### ExportRequestDto
```typescript
{
  type: ExportType;
  format: ExportFormat;
  fromDate?: string;
  toDate?: string;
  assets?: string[];
  limit?: number;
  offset?: number;
}
```

### ExportResponseDto
```typescript
{
  success: boolean;
  message: string;
  downloadUrl?: string;
  filename?: string;
  recordCount?: number;
  fileSize?: string;
  exportType: ExportType;
  format: ExportFormat;
  generatedAt: string;
}
```

## File Management

### Export Directory Structure
```
exports/
├── trades_2024-02-25T22-00-00-000Z.csv
├── balances_2024-02-25T22-05-00-000Z.xlsx
└── complete_export_2024-02-25T22-10-00-000Z.xlsx
```

### File Naming Convention
- Format: `{type}_{timestamp}.{extension}`
- Timestamp: ISO format with special characters replaced
- Unique filenames prevent conflicts

### Automatic Cleanup
- Old files automatically cleaned up after 24 hours
- Configurable cleanup interval
- Manual cleanup available via API

## Data Validation

### Input Validation
- Date range validation
- Asset symbol validation
- Format and type validation
- Pagination parameter validation

### Data Integrity
- Database query validation
- Export data completeness checks
- File generation error handling

## Performance Considerations

### Large Dataset Handling
- Pagination for memory efficiency
- Streaming for large file generation
- Query optimization for fast data retrieval

### Caching Strategy
- Export preview caching
- File metadata caching
- Query result optimization

## Security

### Access Control
- User-specific data export only
- Authentication required for all endpoints
- File access validation

### Data Protection
- Secure file storage
- Temporary file cleanup
- No sensitive data in filenames

## Error Handling

### Common Errors

1. **Invalid Export Parameters**
   - Validation errors for date ranges
   - Unsupported formats or types
   - Invalid asset symbols

2. **File Generation Errors**
   - Disk space issues
   - Permission problems
   - Data processing errors

3. **Download Errors**
   - File not found
   - Expired download links
   - Network issues

### Error Responses
- Detailed error messages
- HTTP status codes
- Error categorization

## Monitoring

### Export Metrics
- Export request counts
- File generation times
- Download statistics
- Error rates

### Health Monitoring
- Export directory status
- Disk space monitoring
- Service availability

## Configuration

### Environment Variables
```env
EXPORT_DIR=exports
EXPORT_MAX_AGE_HOURS=24
EXPORT_MAX_RECORDS=100000
EXPORT_CLEANUP_INTERVAL_HOURS=1
```

### Service Configuration
- Export directory location
- File retention policies
- Performance limits

## Troubleshooting

### Common Issues

1. **Export Generation Fails**
   - Check database connectivity
   - Verify disk space availability
   - Review export parameters

2. **File Download Issues**
   - Verify file exists
   - Check file permissions
   - Validate download URL

3. **Performance Issues**
   - Reduce export record limit
   - Optimize date range filtering
   - Check database query performance

### Debug Logging
Enable debug logging for detailed troubleshooting:
```env
LOG_LEVEL=debug
```

## Future Enhancements

1. **Advanced Features**
   - Scheduled exports
   - Export templates
   - Data transformation options

2. **Performance Improvements**
   - Background job processing
   - Parallel export generation
   - Incremental exports

3. **Additional Formats**
   - JSON format support
   - PDF reports
   - Custom format plugins

## Examples

### Basic Trade Export
```bash
curl -X POST http://localhost:3000/export/generate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "trades",
    "format": "csv",
    "fromDate": "2024-01-01T00:00:00.000Z",
    "toDate": "2024-02-01T00:00:00.000Z"
  }'
```

### Export with Asset Filtering
```bash
curl -X POST http://localhost:3000/export/generate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "balances",
    "format": "excel",
    "assets": ["BTC", "ETH", "USDT"]
  }'
```

### Export Preview
```bash
curl "http://localhost:3000/export/preview?type=trades&format=csv&limit=100"
```
