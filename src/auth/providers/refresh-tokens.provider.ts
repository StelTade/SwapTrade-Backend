import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { RefreshTokenDto } from '../dtos/refreshTokenDto';
import { JwtService } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import jwtConfig from '../authConfig/jwt.config';
import { GenerateTokensProvider } from './generate-tokens.provider';
import { UserServices } from 'src/user/provider/user-services.service';

@Injectable()
export class RefreshTokensProvider {
  constructor(
    /*
     * injecting userService repo
     */
    @Inject(forwardRef(() => UserServices))
    private readonly userService: UserServices,

    /*
     * inject jwtService
     */
    private readonly jwtService: JwtService,

    /*
     * inject jwtService
     */
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,

    /* 
     * inject generateTokenProvider
     */
    private readonly generateTokenProvider: GenerateTokensProvider
  ) {}
  public async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    // validate the refresh token using jwt
   const { sub } = await this.jwtService.verifyAsync(
        refreshTokenDto.refreshToken, 
        {
        secret: this.jwtConfiguration.secret,
        audience: this.jwtConfiguration.audience,
        issuer: this.jwtConfiguration.issuer,
    })

    // grab the user from the database
    const user = await this.userService.FindOneById(sub)

    // generate the token
    return await this.generateTokenProvider.generateTokens(user)
  }
}