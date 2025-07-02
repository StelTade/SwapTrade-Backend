import {
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RefreshTokenDto } from '../dtos/refreshTokenDto';
import { JwtService } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import jwtConfig from '../authConfig/jwt.config';
import { GenerateTokensProvider } from './generate-tokens.provider';
import { UserService } from 'src/user/provider/user-services.service';

@Injectable()
export class RefreshTokensProvider {
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,

    private readonly jwtService: JwtService,

    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,

    private readonly generateTokenProvider: GenerateTokensProvider
  ) {}

  public async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    const { sub } = await this.jwtService.verifyAsync(
      refreshTokenDto.refreshToken,
      {
        secret: this.jwtConfiguration.secret,
        audience: this.jwtConfiguration.audience,
        issuer: this.jwtConfiguration.issuer,
      }
    );

    const user = await this.userService.findOneById(sub);

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return await this.generateTokenProvider.generateTokens(user);
  }
}
