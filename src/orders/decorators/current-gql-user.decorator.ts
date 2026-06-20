import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentGqlUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const gqlContext = GqlExecutionContext.create(context);
    return gqlContext.getContext().req.user;
  },
);
