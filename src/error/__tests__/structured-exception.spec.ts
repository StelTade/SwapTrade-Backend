import { HttpStatus } from '@nestjs/common';
import { StructuredException } from '../errors/structured.exception';

describe('StructuredException', () => {
  it('should create exception with correct properties', () => {
    const exception = new StructuredException(
      'TEST_ERROR_400',
      'Test error message',
      HttpStatus.BAD_REQUEST,
      { field: 'test' },
      'req-123',
      true,
    );

    expect(exception.code).toBe('TEST_ERROR_400');
    expect(exception.message).toBe('Test error message');
    expect(exception.httpStatus).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.details).toEqual({ field: 'test' });
    expect(exception.requestId).toBe('req-123');
    expect(exception.retryable).toBe(true);
    expect(exception.timestamp).toBeInstanceOf(Date);
  });

  it('should generate correct response format', () => {
    const exception = new StructuredException(
      'TEST_ERROR_400',
      'Test error message',
      HttpStatus.BAD_REQUEST,
      { field: 'test' },
      'req-123',
      false,
    );

    const response = exception.toResponse();

    expect(response).toHaveProperty('error');
    expect(response.error.code).toBe('TEST_ERROR_400');
    expect(response.error.message).toBe('Test error message');
    expect(response.error.details).toEqual({ field: 'test' });
    expect(response.error.requestId).toBe('req-123');
    expect(response.error.retryable).toBe(false);
    expect(response.error.timestamp).toBeDefined();
  });

  it('should have correct default values', () => {
    const exception = new StructuredException('TEST_ERROR', 'Test message');

    expect(exception.httpStatus).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(exception.details).toBeUndefined();
    expect(exception.requestId).toBeUndefined();
    expect(exception.retryable).toBe(false);
  });
});
