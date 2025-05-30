import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import jwtConfig from '../authConfig/jwt.config';
import { ConfigType } from '@nestjs/config';
// import { UserServices } from 'src/users/Providers/users.services';
// import { User } from 'src/users/user.entity';
import { ActiveUserData } from '../interface/activeInterface';
import { User } from 'src/user/user.entity';
import { UserServices } from 'src/user/provider/user-services.service';

@Injectable()
export class GenerateTokensProvider {
  constructor(
    /*
     * injecting userService repo
     */
    @Inject(forwardRef(() => UserServices))
    private readonly userService: UserServices,

    /*
     *injecting jwtService
     */
    private readonly jwtService: JwtService,

    /*
     * injecting jwtConfig
     */
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  public async signToken<T>(userId: number, expiresIn: number, payload?: T) {
    return await this.jwtService.signAsync(
      {
        sub: userId,
        ...payload,
      } as ActiveUserData,
      {
        secret: this.jwtConfiguration.secret,
        audience: this.jwtConfiguration.audience,
        issuer: this.jwtConfiguration.issuer,
        expiresIn,
      },
    );
  }

  public async generateTokens(user: User) {
    const [accessToken, refreshToken] = await Promise.all([
    // generate access token
    this.signToken(user.id, this.jwtConfiguration.ttl, {email: user.email}),

    // generate refresh token
    this.signToken(user.id, this.jwtConfiguration.ttl)
    ])
    
    return {'accessToken': accessToken, 'refreshToken': refreshToken, user}
  }
}