import { HttpException, HttpStatus } from '@nestjs/common';
import { AppExceptionFilter } from '../filters/app-exception.filter';
import { StructuredException } from '../errors/structured.exception';
import { ValidationException } from '../exceptions/validation.exception';
import { AuthenticationException } from '../exceptions/authentication.exception';

describe('AppExceptionFilter - Deterministic Error Responses', () => {
  let filter: AppExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new AppExceptionFilter();

    // Mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Mock request
    mockRequest = {
      headers: {
        'x-request-id': 'req-123',
      },
      method: 'GET',
      url: '/api/test',
    };

    // Mock ArgumentsHost
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    };
  });

  describe('StructuredException Handling', () => {
    it('should handle StructuredException with correct HTTP status', () => {
      const exception = new StructuredException(
        'TEST_ERROR_400',
        'Test error message',
        HttpStatus.BAD_REQUEST,
        { field: 'test' },
        'req-123',
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'TEST_ERROR_400',
            message: 'Test error message',
            requestId: 'req-123',
            retryable: false,
          }),
        }),
      );
    });

    it('should handle ValidationException', () => {
      const exception = ValidationException.invalidInput({ field: 'email' });

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.code).toBe('VALIDATION_INVALID_INPUT_400');
      expect(callArgs.success).toBe(false);
    });

    it('should handle AuthenticationException', () => {
      const exception = AuthenticationException.tokenExpired();

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.code).toBe('AUTH_TOKEN_EXPIRED_401');
    });
  });

  describe('HttpException Handling', () => {
    it('should handle standard HttpException', () => {
      const exception = new HttpException(
        { message: 'Not found' },
        HttpStatus.NOT_FOUND,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.success).toBe(false);
      expect(callArgs.error.code).toBeDefined();
      expect(callArgs.error.timestamp).toBeDefined();
    });

    it('should handle HttpException with string message', () => {
      const exception = new HttpException(
        'Unauthorized access',
        HttpStatus.UNAUTHORIZED,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.message).toBe('Unauthorized access');
      expect(callArgs.error.retryable).toBe(false);
    });
  });

  describe('Generic Error Handling', () => {
    it('should handle generic Error objects', () => {
      const error = new Error('Something went wrong');

      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.code).toBe('INTERNAL_SERVER_ERROR_500');
      expect(callArgs.success).toBe(false);
      expect(callArgs.error.retryable).toBe(false);
    });

    it('should handle unknown exceptions', () => {
      const unknownException = { some: 'unknown' };

      filter.catch(unknownException, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.success).toBe(false);
      expect(callArgs.error.code).toBeDefined();
    });
  });

  describe('Deterministic Response Format', () => {
    it('should always include required fields', () => {
      const exception = new StructuredException('TEST_ERROR', 'Test message');

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs).toHaveProperty('success', false);
      expect(callArgs).toHaveProperty('error');
      expect(callArgs.error).toHaveProperty('code');
      expect(callArgs.error).toHaveProperty('message');
      expect(callArgs.error).toHaveProperty('timestamp');
      expect(callArgs.error).toHaveProperty('retryable');
      expect(callArgs.error).toHaveProperty('severity');
      expect(callArgs.error).toHaveProperty('category');
    });

    it('should use ISO 8601 timestamp format', () => {
      const exception = new StructuredException('TEST_ERROR', 'Test message');

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      expect(isoRegex.test(callArgs.error.timestamp)).toBe(true);
    });

    it('should extract request ID from headers', () => {
      const exception = new Error('Test error');

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.requestId).toBe('req-123');
    });

    it('should handle missing request ID gracefully', () => {
      mockRequest.headers = {};

      const exception = new Error('Test error');

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error).toHaveProperty('requestId');
    });
  });

  describe('Retryable Flag Determination', () => {
    it('should mark 503 errors as retryable', () => {
      const exception = new HttpException(
        'Service Unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.retryable).toBe(true);
    });

    it('should mark 429 errors as retryable', () => {
      const exception = new HttpException('Too Many Requests', 429);

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.retryable).toBe(true);
    });

    it('should mark 400 errors as not retryable', () => {
      const exception = new HttpException(
        'Bad Request',
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.retryable).toBe(false);
    });

    it('should mark 401 errors as not retryable', () => {
      const exception = new HttpException(
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.retryable).toBe(false);
    });
  });

  describe('Severity Determination', () => {
    it('should mark 5xx errors as SERVER severity', () => {
      const exception = new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.severity).toBe('SERVER');
    });

    it('should mark 4xx errors as CLIENT severity', () => {
      const exception = new HttpException(
        'Bad Request',
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.severity).toBe('CLIENT');
    });

    it('should mark 429 errors as TRANSIENT severity', () => {
      const exception = new HttpException('Too Many Requests', 429);

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.severity).toBe('TRANSIENT');
    });
  });

  describe('Error Code Mapping', () => {
    it('should map 400 to VALIDATION error code', () => {
      const exception = new HttpException('Bad Request', 400);

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.code).toBe('VALIDATION_INVALID_INPUT_400');
    });

    it('should map 401 to AUTH error code', () => {
      const exception = new HttpException('Unauthorized', 401);

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.code).toBe('AUTH_INVALID_CREDENTIALS_401');
    });

    it('should map 404 to NOT_FOUND error code', () => {
      const exception = new HttpException('Not Found', 404);

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.code).toBe('DATABASE_RECORD_NOT_FOUND_404');
    });

    it('should map 429 to RATE_LIMIT error code', () => {
      const exception = new HttpException('Too Many Requests', 429);

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.code).toBe('RATE_LIMIT_EXCEEDED_429');
    });

    it('should map 503 to SERVICE_UNAVAILABLE error code', () => {
      const exception = new HttpException(
        'Service Unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.code).toBe('DATABASE_CONNECTION_ERROR_503');
    });
  });

  describe('Response Consistency Across Error Types', () => {
    it('should produce consistent response format for all error types', () => {
      const exceptions = [
        new StructuredException('TEST_ERROR', 'Test message'),
        new ValidationException(),
        new AuthenticationException(),
        new HttpException('Test', HttpStatus.BAD_REQUEST),
        new Error('Generic error'),
      ];

      exceptions.forEach((exception, index) => {
        mockResponse.json.mockClear();
        filter.catch(exception, mockHost);

        const callArgs = mockResponse.json.mock.calls[0][0];

        // All responses should have these fields
        expect(callArgs).toHaveProperty('success', false);
        expect(callArgs.error).toHaveProperty('code');
        expect(callArgs.error).toHaveProperty('message');
        expect(callArgs.error).toHaveProperty('timestamp');
        expect(callArgs.error).toHaveProperty('retryable');
        expect(callArgs.error).toHaveProperty('severity');
        expect(callArgs.error).toHaveProperty('category');
      });
    });
  });

  describe('Details and Metadata Handling', () => {
    it('should preserve exception details', () => {
      const details = { field: 'email', value: 'invalid' };
      const exception = new StructuredException(
        'TEST_ERROR',
        'Test message',
        HttpStatus.BAD_REQUEST,
        details,
      );

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error.details).toEqual(details);
    });

    it('should handle missing details gracefully', () => {
      const exception = new StructuredException(
        'TEST_ERROR',
        'Test message',
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      const callArgs = mockResponse.json.mock.calls[0][0];
      expect(callArgs.error).toHaveProperty('details');
    });
  });
});
