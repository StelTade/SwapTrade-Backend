import { Module } from '@nestjs/common';
import { UserServices } from './provider/user-services.service';

@Module({
  providers: [UserServices]
})
export class UserModule {}
