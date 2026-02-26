import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class ComplexityGuard implements CanActivate {
  private readonly MAX_DEPTH = 10;
  private readonly MAX_ARRAY_LENGTH = 500;
  private readonly MAX_KEYS = 100;
  private readonly MAX_COMPLEXITY_SCORE = 5000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const body = request.body;

    if (body && typeof body === 'object') {
      try {
        const complexity = this.calculateComplexity(body, 1);
        if (complexity > this.MAX_COMPLEXITY_SCORE) {
           throw new HttpException({
             status: HttpStatus.PAYLOAD_TOO_LARGE,
             error: 'Request Complexity Limit Exceeded',
             message: `Request complexity score ${complexity} exceeds limit of ${this.MAX_COMPLEXITY_SCORE}`,
           }, HttpStatus.PAYLOAD_TOO_LARGE);
        }
      } catch (error) {
        if (error instanceof HttpException) throw error;
        throw new HttpException('Invalid request structure', HttpStatus.BAD_REQUEST);
      }
    }
    return true;
  }

  private calculateComplexity(obj: any, depth: number): number {
    if (depth > this.MAX_DEPTH) {
      throw new HttpException(`Request depth exceeds limit of ${this.MAX_DEPTH}`, HttpStatus.BAD_REQUEST);
    }
    
    let score = 1;
    
    if (Array.isArray(obj)) {
      if (obj.length > this.MAX_ARRAY_LENGTH) {
        throw new HttpException(`Array length exceeds limit of ${this.MAX_ARRAY_LENGTH}`, HttpStatus.BAD_REQUEST);
      }
      for (const item of obj) {
        score += (typeof item === 'object' && item !== null) ? this.calculateComplexity(item, depth + 1) : 1;
      }
    } else if (typeof obj === 'object' && obj !== null) {
      const keys = Object.keys(obj);
      if (keys.length > this.MAX_KEYS) throw new HttpException(`Object keys count exceeds limit of ${this.MAX_KEYS}`, HttpStatus.BAD_REQUEST);
      for (const key of keys) {
        score += this.calculateComplexity(obj[key], depth + 1);
      }
    }
    
    return score;
  }
}