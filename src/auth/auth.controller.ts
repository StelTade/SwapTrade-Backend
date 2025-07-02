import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './providers/auth.service';
import { SignInDto } from './dtos/userDto';
import { RefreshTokenDto } from './dtos/refreshTokenDto';
import { RegisterDto } from './dtos/register.dto';
import { Auth } from './decorators/auth.decorator';
import { authTypes } from './enums/authTypes.enum';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/signIn')
  @Auth(authTypes.None)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(ClassSerializerInterceptor)
  public async signIn(@Body() signInDto: SignInDto) {
    return await this.authService.SignIn(signInDto);
  }

  @Post('/login')
  @Auth(authTypes.None)
  @HttpCode(HttpStatus.OK)
  public async login(@Body() signInDto: SignInDto) {
    return await this.authService.SignIn(signInDto);
  }

  @Post('/refreshToken')
  public RefreshToken(@Body() refreshToken: RefreshTokenDto) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('/register')
  @Auth(authTypes.None)
  public async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('/verify-email')
  @Auth(authTypes.None)
  public async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }
}
