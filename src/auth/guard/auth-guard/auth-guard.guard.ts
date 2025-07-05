import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessTokenGuard } from '../access-token/access-token.guard';
import { authTypes } from '../../enums/authTypes.enum';
import { AUTH_TYPE_KEY } from 'src/auth/constants/auth.constant';

@Injectable()
export class AuthGuardGuard implements CanActivate {
  private static readonly defaultAuthType = authTypes.Bearer;

  private readonly authTypeGuardMap: Record<authTypes, CanActivate>;

  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokenGuard: AccessTokenGuard,
  ) {
    this.authTypeGuardMap = {
      [authTypes.Bearer]: this.accessTokenGuard,
      [authTypes.None]: { canActivate: async () => true },
    };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authTypes = this.reflector.getAllAndOverride<authTypes[]>(
      AUTH_TYPE_KEY,
      [context.getHandler(), context.getClass()]
    ) ?? [AuthGuardGuard.defaultAuthType];

    const guards = authTypes.map((type) => this.authTypeGuardMap[type]);

    for (const guard of guards) {
      try {
        const canActivate = await guard.canActivate(context);
        if (canActivate) return true;
      } catch (err) {
        // Optional: log or handle errors here
      }
    }

    throw new UnauthorizedException();
  }
}
