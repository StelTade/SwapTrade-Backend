import { Injectable } from '@nestjs/common';

@Injectable()
export class BiddingService {
  login(body: any) {
    // Placeholder logic
    return { message: 'Logged in', body };
  }
}