import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './providers/auth.service';
import { BcryptProvider } from './providers/bcrypt';
import { HashingProvider } from './providers/hashing';
import { SignInProvider } from './providers/sign-in.provider';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import jwtConfig from 'src/auth/authConfig/jwt.config';
import { GenerateTokensProvider } from './providers/generate-tokens.provider';
import { RefreshTokensProvider } from './providers/refresh-tokens.provider';

@Module({
  imports: [
    // forwardRef(() => UsersModule),
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: HashingProvider, // Use the abstract class as a token
      useClass: BcryptProvider, // Bind it to the concrete implementation
    },
    SignInProvider,
    GenerateTokensProvider,
    RefreshTokensProvider,
    // GoogleAuthenticationService,
  ],
  exports: [AuthService, HashingProvider],
})
export class AuthModule {}
