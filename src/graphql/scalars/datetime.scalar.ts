import { Scalar } from '@nestjs/graphql';
import { Kind } from 'graphql';

@Scalar('DateTime')
export class DateTimeScalar {
  parseValue(value: string): Date {
    return new Date(value);
  }

  serialize(value: Date): string {
    return value.toISOString();
  }

  parseLiteral(ast: any): Date {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    throw new Error('DateTimeScalar can only parse string values');
  }
}
