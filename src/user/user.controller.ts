import { Controller } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('User')
export class UserController {
  constructor(private readonly UserService: UserService) {}

}