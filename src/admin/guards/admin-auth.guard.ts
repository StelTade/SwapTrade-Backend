/**
 * Admin Auth Guard - 管理员权限验证
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('缺少认证令牌');
    }

    try {
      // 验证 token 并获取用户信息
      const user = await this.authService.validateToken(token);

      if (!user) {
        throw new UnauthorizedException('无效的认证令牌');
      }

      // 检查是否为管理员角色
      if (user.role !== 'admin' && user.role !== 'super-admin') {
        throw new ForbiddenException('需要管理员权限');
      }

      // 将用户信息附加到请求对象
      request['user'] = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('认证失败');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
