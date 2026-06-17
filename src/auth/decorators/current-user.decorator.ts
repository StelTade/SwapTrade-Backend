import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../guards/jwt-auth.guard';

/**
 * Extracts the authenticated user from the request.
 *
 * @example
 * @Get('me')
 * getMe(@CurrentUser() user: JwtPayload) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
