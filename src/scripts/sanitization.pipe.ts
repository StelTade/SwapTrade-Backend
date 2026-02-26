import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class SanitizationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (!value || typeof value !== 'object') {
      return typeof value === 'string' ? this.sanitize(value) : value;
    }
    this.sanitizeObject(value);
    return value;
  }

  private sanitizeObject(obj: any) {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = this.sanitize(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.sanitizeObject(obj[key]);
      }
    }
  }

  private sanitize(str: string): string {
    // Basic sanitization to remove script tags and potential XSS vectors
    return str
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
      .replace(/<[^>]+>/g, "") // Remove HTML tags
      .trim();
  }
}