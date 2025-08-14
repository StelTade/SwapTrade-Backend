import { Controller, Post, Body } from '@nestjs/common';
import { IsEmail, IsNotEmpty } from 'class-validator';

class TestDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  name: string;
}

@Controller('test-validation')
export class TestValidationController {
  @Post()
  test(@Body() dto: TestDto) {
    return { message: 'Validation passed', data: dto };
  }
}
