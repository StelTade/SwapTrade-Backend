import {
    forwardRef,
    Inject,
    Injectable,
    RequestTimeoutException,
    UnauthorizedException,
  } from '@nestjs/common';
  import { SignInDto } from '../dtos/userDto';
  import * as bcrypt from 'bcrypt'; // Assuming bcrypt
  import { GenerateTokensProvider } from './generate-tokens.provider';
  import { UserServices } from 'src/user/provider/user-services.service';
import { HashingProvider } from './hashing';
  
  @Injectable()
  export class SignInProvider {
    constructor(
      @Inject(forwardRef(() => UserServices))
      private readonly userService: UserServices,
        private readonly hashingProvider: HashingProvider,
      private readonly generateTokenProvider: GenerateTokensProvider
    ) {}
  
    public async SignIn(signInDto: SignInDto) {
        let user = await this.userService.getOneByEmail(signInDto.email);
        if (!user) {
          throw new UnauthorizedException('email or password is incorrect');
        }
        
        let isCheckedPassword: boolean = false;
        
        if (!user.password) {
            throw new UnauthorizedException('Email or password is incorrect');
          }
          
          isCheckedPassword = await this.hashingProvider.comparePasswords(
            signInDto.password,
            user.password
          );
          
        
  
      if (!isCheckedPassword) {
        throw new UnauthorizedException('Email or password is incorrect');
      }
  
      return await this.generateTokenProvider.generateTokens(user);
    }
  }
  