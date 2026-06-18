import { HttpStatus } from '@nestjs/common';
import { StructuredException } from '../errors/structured.exception';
import { ValidationException } from '../exceptions/validation.exception';
import { AuthenticationException } from '../exceptions/authentication.exception';
import { BlockchainException } from '../exceptions/blockchain.exception';
import { AIServiceException } from '../exceptions/ai-service.exception';

describe('Exception Classes - Deterministic Error Responses', () => {
  describe('StructuredException', () => {
    it('should create exception with exact error properties', () => {
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

    it('should generate deterministic response format', () => {
      const exception = new StructuredException(
        'TEST_ERROR_400',
        'Test error message',
        HttpStatus.BAD_REQUEST,
        { field: 'test' },
        'req-123',
        false,
      );

      const response = exception.toResponse();

      // Verify exact structure
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code', 'TEST_ERROR_400');
      expect(response.error).toHaveProperty('message', 'Test error message');
      expect(response.error).toHaveProperty('details', { field: 'test' });
      expect(response.error).toHaveProperty('requestId', 'req-123');
      expect(response.error).toHaveProperty('retryable', false);
      expect(response.error).toHaveProperty('timestamp');

      // Verify timestamp is ISO string
      expect(typeof response.error.timestamp).toBe('string');
      expect(response.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should use default values correctly', () => {
      const exception = new StructuredException('TEST_ERROR', 'Test message');

      expect(exception.httpStatus).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(exception.details).toBeUndefined();
      expect(exception.requestId).toBeUndefined();
      expect(exception.retryable).toBe(false);
    });

    it('should maintain stack trace', () => {
      const exception = new StructuredException(
        'TEST_ERROR_400',
        'Test message',
      );

      expect(exception.stack).toBeDefined();
      expect(exception.name).toBe('StructuredException');
    });
  });

  describe('ValidationException', () => {
    it('should create with VALIDATION_INVALID_INPUT_400 by default', () => {
      const exception = ValidationException.invalidInput(
        { field: 'email' },
        'req-123',
      );

      expect(exception.code).toBe('VALIDATION_INVALID_INPUT_400');
      expect(exception.httpStatus).toBe(400);
      expect(exception.message).toBe('Invalid input data provided');
      expect(exception.details).toEqual({ field: 'email' });
    });

    it('should create missingRequiredField error', () => {
      const exception = ValidationException.missingRequiredField(
        { field: 'password' },
        'req-123',
      );

      expect(exception.code).toBe('VALIDATION_MISSING_REQUIRED_FIELD_400');
      expect(exception.httpStatus).toBe(400);
      expect(exception.message).toBe('Required field is missing');
      expect(exception.details).toEqual({ field: 'password' });
    });

    it('should create invalidFormat error', () => {
      const exception = ValidationException.invalidFormat(
        { expectedFormat: 'UUID' },
        'req-123',
      );

      expect(exception.code).toBe('VALIDATION_INVALID_FORMAT_400');
      expect(exception.httpStatus).toBe(400);
      expect(exception.message).toBe('Invalid data format');
      expect(exception.details).toEqual({ expectedFormat: 'UUID' });
    });

    it('should be retryable false', () => {
      const exception = ValidationException.invalidInput();
      expect(exception.retryable).toBe(false);
    });
  });

  describe('AuthenticationException', () => {
    it('should create tokenExpired error', () => {
      const exception = AuthenticationException.tokenExpired(
        undefined,
        'req-123',
      );

      expect(exception.code).toBe('AUTH_TOKEN_EXPIRED_401');
      expect(exception.httpStatus).toBe(401);
      expect(exception.message).toBe('Authentication token has expired');
      expect(exception.retryable).toBe(false);
    });

    it('should create invalidCredentials error', () => {
      const exception = AuthenticationException.invalidCredentials(
        { reason: 'wrong password' },
        'req-123',
      );

      expect(exception.code).toBe('AUTH_INVALID_CREDENTIALS_401');
      expect(exception.httpStatus).toBe(401);
      expect(exception.message).toBe('Invalid username or password');
    });

    it('should create insufficientPermissions error', () => {
      const exception = AuthenticationException.insufficientPermissions(
        { required: 'ADMIN' },
        'req-123',
      );

      expect(exception.code).toBe('AUTH_INSUFFICIENT_PERMISSIONS_403');
      expect(exception.httpStatus).toBe(403);
      expect(exception.message).toBe(
        'Insufficient permissions for this operation',
      );
    });

    it('should create tokenMissing error', () => {
      const exception = AuthenticationException.tokenMissing(
        undefined,
        'req-123',
      );

      expect(exception.code).toBe('AUTH_TOKEN_MISSING_401');
      expect(exception.httpStatus).toBe(401);
    });

    it('should create tokenInvalid error', () => {
      const exception = AuthenticationException.tokenInvalid(
        undefined,
        'req-123',
      );

      expect(exception.code).toBe('AUTH_TOKEN_INVALID_401');
      expect(exception.httpStatus).toBe(401);
    });
  });

  describe('BlockchainException', () => {
    it('should create transactionFailed error', () => {
      const exception = BlockchainException.transactionFailed(
        { txHash: '0x123' },
        'req-123',
      );

      expect(exception.code).toBe('BLOCKCHAIN_TRANSACTION_FAILED_500');
      expect(exception.httpStatus).toBe(500);
      expect(exception.message).toBe('Blockchain transaction failed');
      expect(exception.retryable).toBe(true);
    });

    it('should create networkError', () => {
      const exception = BlockchainException.networkError(
        { endpoint: 'https://eth-mainnet.com' },
        'req-123',
      );

      expect(exception.code).toBe('BLOCKCHAIN_NETWORK_ERROR_503');
      expect(exception.httpStatus).toBe(503);
      expect(exception.message).toBe('Blockchain network is unavailable');
      expect(exception.retryable).toBe(true);
    });

    it('should create insufficientGas error', () => {
      const exception = BlockchainException.insufficientGas(
        { required: '2.5 ETH', available: '1.0 ETH' },
        'req-123',
      );

      expect(exception.code).toBe('BLOCKCHAIN_INSUFFICIENT_GAS_400');
      expect(exception.httpStatus).toBe(400);
      expect(exception.message).toBe('Insufficient gas for transaction');
      expect(exception.retryable).toBe(false);
    });
  });

  describe('AIServiceException', () => {
    it('should create serviceUnavailable error', () => {
      const exception = AIServiceException.serviceUnavailable(
        { service: 'sentiment-analyzer' },
        'req-123',
      );

      expect(exception.code).toBe('AI_SERVICE_UNAVAILABLE_503');
      expect(exception.httpStatus).toBe(503);
      expect(exception.message).toBe('AI service is temporarily unavailable');
      expect(exception.retryable).toBe(true);
    });

    it('should create invalidRequest error', () => {
      const exception = AIServiceException.invalidRequest(
        { reason: 'Invalid input format' },
        'req-123',
      );

      expect(exception.code).toBe('AI_SERVICE_INVALID_REQUEST_400');
      expect(exception.httpStatus).toBe(400);
      expect(exception.message).toBe('Invalid request to AI service');
      expect(exception.retryable).toBe(false);
    });
  });

  describe('Exception Inheritance and Contract Compliance', () => {
    it('all exceptions should extend StructuredException', () => {
      const exceptions = [
        new ValidationException(),
        new AuthenticationException(),
        new BlockchainException(),
        new AIServiceException(),
      ];

      exceptions.forEach((ex) => {
        expect(ex).toBeInstanceOf(StructuredException);
        expect(ex).toHaveProperty('code');
        expect(ex).toHaveProperty('httpStatus');
        expect(ex).toHaveProperty('message');
        expect(ex).toHaveProperty('timestamp');
        expect(ex).toHaveProperty('retryable');
        expect(ex).toHaveProperty('toResponse');
      });
    });

    it('all exceptions should have deterministic toResponse format', () => {
      const exceptions = [
        new ValidationException(),
        new AuthenticationException(),
        new BlockchainException(),
        new AIServiceException(),
      ];

      exceptions.forEach((ex) => {
        const response = ex.toResponse();

        expect(response).toHaveProperty('error');
        expect(response.error).toHaveProperty('code');
        expect(response.error).toHaveProperty('message');
        expect(response.error).toHaveProperty('timestamp');
        expect(response.error).toHaveProperty('retryable');
      });
    });
  });

  describe('Deterministic Error Response Contract', () => {
    it('error response should always have success: false', () => {
      const exceptions = [
        new ValidationException(),
        new AuthenticationException(),
        new BlockchainException(),
        new AIServiceException(),
      ];

      exceptions.forEach((ex) => {
        const response = ex.toResponse();
        expect(response.success).toBe(false);
      });
    });

    it('error code should match error definition', () => {
      const exception = ValidationException.invalidInput({
        field: 'test',
      });

      const response = exception.toResponse();
      expect(response.error.code).toBe('VALIDATION_INVALID_INPUT_400');
    });

    it('timestamp should be ISO 8601 string', () => {
      const exception = new StructuredException('TEST_ERROR', 'Test message');

      const response = exception.toResponse();
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      expect(isoRegex.test(response.error.timestamp)).toBe(true);
    });

    it('requestId should be preserved', () => {
      const exception = new StructuredException(
        'TEST_ERROR',
        'Test message',
        HttpStatus.BAD_REQUEST,
        undefined,
        'custom-req-id',
      );

      const response = exception.toResponse();
      expect(response.error.requestId).toBe('custom-req-id');
    });

    it('retryable flag should match error definition', () => {
      const transientEx = new StructuredException(
        'BLOCKCHAIN_NETWORK_ERROR_503',
        'Network unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        undefined,
        'req-123',
        true,
      );

      const nonRetryableEx = new StructuredException(
        'VALIDATION_INVALID_INPUT_400',
        'Invalid input',
        HttpStatus.BAD_REQUEST,
        undefined,
        'req-123',
        false,
      );

      expect(transientEx.toResponse().error.retryable).toBe(true);
      expect(nonRetryableEx.toResponse().error.retryable).toBe(false);
    });
  });
});
