import { Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  login(body: LoginDto) {
    // Placeholder logic
    return { message: 'Logged in', body };
  }
}
