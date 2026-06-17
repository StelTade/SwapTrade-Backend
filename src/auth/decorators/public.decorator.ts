import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public — bypasses JwtAuthGuard.
 *
 * @example
 * @Public()
 * @Post('login')
 * login() {}
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
