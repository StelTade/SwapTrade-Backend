import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip as string;
    const whitelistEnv = process.env.ADMIN_IP_WHITELIST ?? '';
    if (!whitelistEnv) {
      return true;
    }
    const whitelist = whitelistEnv.split(',').map((x) => x.trim()).filter(Boolean);
    if (whitelist.length === 0) {
      return true;
    }
    if (!whitelist.includes(ip)) {
      throw new ForbiddenException('IP not allowed');
    }
    return true;
  }
}

