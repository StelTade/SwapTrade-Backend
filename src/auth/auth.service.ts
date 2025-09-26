import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  login(body: any) {
    // Placeholder logic
    return { message: 'Logged in', body };
  }
}