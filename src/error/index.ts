// Errors
export { StructuredException } from './errors/structured.exception';

// Exceptions
export { AuthenticationException } from './exceptions/authentication.exception';
export { ValidationException } from './exceptions/validation.exception';
export { BlockchainException } from './exceptions/blockchain.exception';
export { AIServiceException } from './exceptions/ai-service.exception';

// Filters
export { AppExceptionFilter } from './filters/app-exception.filter';

// Constants
export { ERROR_CODES } from './constants/error-codes';
export type { ErrorCode } from './constants/error-codes';

// Enums
export { ErrorCategory } from './enums/error-category.enum';
export { ErrorSeverity } from './enums/error-severity.enum';

// Types
export type {
  ErrorMetadata,
  ErrorDetails,
  ErrorInfo,
  StandardErrorResponse,
  ErrorMappingConfig,
  ExceptionMapping,
} from './types/error-response.types';

// Registries
export { ErrorCodeRegistry } from './error-code.registry';
export { ExceptionMapperRegistry } from './registries/exception-mapper.registry';

// Services
export { RequestContextService } from './services/request-context.service';

// Module
export { ErrorModule } from './error.module';
