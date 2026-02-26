# Balance History API Documentation

## Overview

The Balance History API provides users with a comprehensive audit trail of all balance changes over time. This feature enables transparency, transaction verification, and support for balance-related inquiries.

## Features

- **Complete Audit Trail**: Track all balance changes with timestamps and reasons
- **Advanced Filtering**: Filter by date range, asset type, and pagination
- **Security**: Users can only access their own balance history
- **Performance**: Optimized database queries with proper indexing
- **Audit Logging**: All access attempts are logged for security

## API Endpoint

### GET `/balances/history/:userId`

Retrieves paginated balance history for a specific user.

#### Parameters

| Parameter | Type | Location | Description |
|------------|--------|-----------|-------------|
| userId | number | Path | User ID (must match authenticated user) |
| startDate | string | Query | ISO 8601 date (optional) |
| endDate | string | Query | ISO 8601 date (optional) |
| asset | string | Query | Asset symbol (optional) |
| limit | number | Query | Results per page (default: 50, max: 100) |
| offset | number | Query | Pagination offset (default: 0) |

#### Query Examples

```bash
# Get all balance history
GET /balances/history/123

# Get history for specific date range
GET /balances/history/123?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z

# Get history for specific asset
GET /balances/history/123?asset=BTC

# Get paginated results
GET /balances/history/123?limit=20&offset=40

# Combined filters
GET /balances/history/123?asset=BTC&startDate=2024-01-01T00:00:00Z&limit=10&offset=0
```

#### Response Format

```json
{
  "data": [
    {
      "asset": "BTC",
      "amountChanged": 0.5,
      "reason": "TRADE_EXECUTED",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "resultingBalance": 1.5,
      "transactionId": "tx_123",
      "relatedOrderId": "order_456"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0,
  "hasMore": true
}
```

#### Response Fields

| Field | Type | Description |
|-------|--------|-------------|
| data | BalanceHistoryEntryDto[] | Array of balance change entries |
| total | number | Total number of entries matching filters |
| limit | number | Number of entries returned per page |
| offset | number | Number of entries skipped |
| hasMore | boolean | Whether more entries are available |

#### BalanceHistoryEntryDto Fields

| Field | Type | Description |
|-------|--------|-------------|
| asset | string | Asset symbol (e.g., BTC, ETH) |
| amountChanged | number | Amount added (positive) or removed (negative) |
| reason | string | Reason for the balance change |
| timestamp | string | ISO 8601 formatted timestamp |
| resultingBalance | number | Balance after the change |
| transactionId | string | Related transaction ID (optional) |
| relatedOrderId | string | Related order ID (optional) |

## Security

### Authentication & Authorization

- **Authentication Required**: Users must be authenticated
- **User Isolation**: Users can only access their own balance history
- **Access Logging**: All access attempts are logged for security
- **403 Forbidden**: Returned when accessing other users' data

### Security Headers

```bash
Authorization: Bearer <jwt_token>
```

## Error Responses

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Access denied: Cannot view other users' balance history"
}
```

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Invalid date format",
  "error": "Invalid query parameters"
}
```

## Balance Change Reasons

| Reason | Description |
|---------|-------------|
| TRADE_EXECUTED | Balance changed due to trade execution |
| TRADE_CANCELLED | Balance restored after trade cancellation |
| BALANCE_DEPOSIT | Manual balance deposit |
| BALANCE_WITHDRAWAL | Manual balance withdrawal |
| REWARD_CLAIMED | Balance increased from reward claiming |
| FEE_CHARGED | Balance decreased due to fees |
| CORRECTION | Manual balance adjustment |

## Performance

### Database Optimization

- **Indexes**: Optimized queries with composite indexes
- **Pagination**: Efficient server-side pagination
- **Caching**: Response caching for recent queries
- **Query Performance**: < 100ms for typical queries

### Rate Limiting

- **Standard**: 100 requests per minute per user
- **Premium**: 500 requests per minute per user
- **Burst**: 10 requests per second

## Integration

### Service Integration

The balance history integrates with:

1. **Trading Service**: Automatic logging of trade-related balance changes
2. **User Service**: Manual balance adjustments
3. **Reward Service**: Balance changes from reward claiming
4. **Audit Service**: Security logging and compliance

### Webhook Support

Balance changes can be sent via webhooks:

```json
{
  "eventType": "BALANCE_CHANGED",
  "userId": "123",
  "data": {
    "asset": "BTC",
    "amountChanged": 0.5,
    "resultingBalance": 1.5,
    "reason": "TRADE_EXECUTED",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Testing

### Unit Tests Coverage

- ✅ Authorized access scenarios
- ✅ Unauthorized access attempts
- ✅ Date range filtering
- ✅ Asset filtering
- ✅ Pagination functionality
- ✅ Empty history handling
- ✅ Invalid query parameters

### Integration Tests

- ✅ End-to-end API testing
- ✅ Database integration
- ✅ Authentication flows
- ✅ Error handling

## Monitoring

### Metrics

- **Request Rate**: Balance history API requests per minute
- **Response Time**: Average response time by query complexity
- **Error Rate**: Failed requests by error type
- **Access Patterns**: User access patterns and frequencies

### Alerts

- **Security Alerts**: Unauthorized access attempts
- **Performance Alerts**: Response time > 500ms
- **Data Alerts**: Unusual balance change patterns

## Examples

### Frontend Integration

```javascript
// React component example
const BalanceHistory = ({ userId }) => {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get(`/balances/history/${userId}`, {
          params: { limit: 20, offset: 0 }
        });
        setHistory(response.data);
      } catch (error) {
        console.error('Failed to fetch balance history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [userId]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {history?.data.map(entry => (
        <div key={entry.timestamp}>
          <span>{entry.asset}</span>
          <span>{entry.amountChanged}</span>
          <span>{entry.reason}</span>
          <span>{new Date(entry.timestamp).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};
```

### Mobile App Integration

```swift
// Swift example
func fetchBalanceHistory(userId: Int, completion: @escaping (Result<BalanceHistoryResponse, Error>) -> Void) {
    let url = baseURL + "/balances/history/\(userId)"
    
    var components = URLComponents(url: url, resolvingAgainstBaseURL: nil)
    components?.queryItems = [
        URLQueryItem(name: "limit", value: "50"),
        URLQueryItem(name: "offset", value: "0")
    ]
    
    guard let finalURL = components?.url else {
        completion(.failure(APIError.invalidURL))
        return
    }
    
    URLSession.shared.dataTask(with: finalURL) { data, response, error in
        // Handle response
    }
}
```

## Support

### Common Issues

1. **Empty History**: New users may have no balance history
2. **Date Filtering**: Ensure ISO 8601 format for dates
3. **Pagination**: Use `hasMore` field to implement infinite scroll
4. **Permissions**: Verify user authentication and authorization

### Troubleshooting

- **403 Errors**: Check authentication token and user ID matching
- **Slow Queries**: Verify database indexes are applied
- **Missing Data**: Check date range and asset filters
- **Large Responses**: Implement proper pagination for large datasets
