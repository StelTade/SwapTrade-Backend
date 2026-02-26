import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  ValidationError,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(Error)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Handle validation errors specifically
    if (exception && exception.message && exception.getStatus) {
      // This is likely a validation error from class-validator
      const status = exception.getStatus();
      
      if (status === HttpStatus.BAD_REQUEST) {
        // Extract validation errors
        const validationErrors = exception.getResponse();
        
        // Format the response consistently
        const errorResponse = {
          error: 'Validation Failed',
          message: this.formatValidationErrors(
            Array.isArray(validationErrors.message) 
              ? validationErrors.message 
              : [validationErrors.message]
          ),
          statusCode: status,
        };

        response.status(status).json(errorResponse);
        return;
      }
    }

    // Handle general errors
    const status =
      exception.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = {
      error: exception.name || 'Internal Server Error',
      message: Array.isArray(exception.message) 
        ? exception.message 
        : [exception.message || 'An unexpected error occurred'],
      statusCode: status,
    };

    // Ensure no system details are exposed in production
    if (process.env.NODE_ENV === 'production') {
      if (status >= 500) {
        errorResponse.error = 'Internal Server Error';
        errorResponse.message = ['An unexpected error occurred'];
      }
    }

    response.status(status).json(errorResponse);
  }

  private formatValidationErrors(errors: any[]): string[] {
    const messages: string[] = [];
    
    if (Array.isArray(errors)) {
      errors.forEach(error => {
        if (error.constraints) {
          Object.values(error.constraints).forEach(msg => {
            messages.push(String(msg));
          });
        }
        if (error.children && error.children.length > 0) {
          messages.push(...this.formatValidationErrors(error.children));
        }
      });
    }
    
    return messages.length > 0 ? messages : ['Validation failed'];
  }
}