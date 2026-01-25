import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { ValidationError } from 'class-validator/types/validation/ValidationError';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }
    
    // Apply trim to string values for sanitization
    const sanitizedValue = this.sanitizeInput(value);
    
    const object = plainToClass(metatype, sanitizedValue);
    const errors = await validate(object);

    if (errors.length > 0) {
      throw new BadRequestException({
        error: 'Validation Failed',
        message: this.formatErrors(errors),
        statusCode: 400,
      });
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private sanitizeInput(value: any): any {
    if (typeof value === 'string') {
      return value.trim();
    } else if (Array.isArray(value)) {
      return value.map(item => this.sanitizeInput(item));
    } else if (value && typeof value === 'object') {
      const sanitized = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          sanitized[key] = this.sanitizeInput(value[key]);
        }
      }
      return sanitized;
    }
    return value;
  }

  private formatErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];
    
    errors.forEach(error => {
      if (error.constraints) {
        Object.values(error.constraints).forEach(msg => {
          messages.push(msg as string);
        });
      }
      
      if (error.children && error.children.length > 0) {
        messages.push(...this.formatErrors(error.children));
      }
    });
    
    return messages.length > 0 ? messages : ['Validation failed'];
  }
}