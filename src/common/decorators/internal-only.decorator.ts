import { SetMetadata } from '@nestjs/common';

export const INTERNAL_ONLY_KEY = 'internalOnly';

/**
 * Marks a controller endpoint or an entire controller as internal-only.
 *
 * When applied, the InternalServiceGuard will reject any HTTP request
 * that does not originate from an internal source (trusted X-Internal-Request
 * header + shared secret, or a loopback IP address).
 *
 * Usage:
 * @InternalOnly()
 * @Get('internal/metrics')
 * getMetrics() { ... }
 */
export const InternalOnly = () => SetMetadata(INTERNAL_ONLY_KEY, true);
