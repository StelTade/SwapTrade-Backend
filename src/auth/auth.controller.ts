
import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiAuthErrorResponses } from '../common/decorators/swagger-error-responses.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}


  @Post('login')
  @ApiOperation({ summary: 'Authenticate user and return JWT token', description: 'Requires email and password. Rate limited to 5 attempts per 15 minutes per user.' })
  @ApiResponse({ status: 201, description: 'Login successful', schema: { example: { accessToken: 'jwt-token' } } })
  @ApiAuthErrorResponses()
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }


  @Post('register')
  @ApiOperation({ summary: 'Register a new user', description: 'Creates a new user account. Rate limited to prevent abuse.' })
  @ApiResponse({ status: 201, description: 'Registration successful', schema: { example: { id: 1, email: 'user@example.com' } } })
  @ApiAuthErrorResponses()
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
}
