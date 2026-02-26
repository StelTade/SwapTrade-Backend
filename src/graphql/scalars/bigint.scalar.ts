import { Scalar } from '@nestjs/graphql';
import { Kind } from 'graphql';

@Scalar('BigInt')
export class BigIntScalar {
  parseValue(value: string): bigint {
    return BigInt(value);
  }

  serialize(value: bigint): string {
    return value.toString();
  }

  parseLiteral(ast: any): bigint {
    if (ast.kind === Kind.INT || ast.kind === Kind.STRING) {
      return BigInt(ast.value);
    }
    throw new Error('BigIntScalar can only parse integer or string values');
  }
}
