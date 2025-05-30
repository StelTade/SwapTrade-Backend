import { forwardRef, Inject, Injectable, RequestTimeoutException, UnauthorizedException } from '@nestjs/common';
// import { Inject } from '@nestjs/typeorm';
import { SignInDto } from '../dtos/userDto';
import { HashingProvider } from './hashing';
import { JwtService } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import jwtConfig from '../authConfig/jwt.config';
import { GenerateTokensProvider } from './generate-tokens.provider';
import { UserServices } from 'src/user/provider/user-services.service';

@Injectable()
export class SignInProvider {
    constructor(
        /* 
         * injecting userService repo
         */
        @Inject(forwardRef(() => UserServices))
        private readonly userService: UserServices,

        /* 
         * injecting hashing dependency
         */
        private readonly hashingProvider: HashingProvider,
        
        /* 
         * injecting generateTokenProvider
         */
        private readonly generateTokenProvider: GenerateTokensProvider
    ){}
    public async SignIn(signInDto: SignInDto) {
        // check if user exist in db
        // throw error if user doesnt exist
        let user = await this.userService.GetOneByEmail(signInDto.email)

        // conpare password
        let isCheckedPassword: boolean = false

        try {
            isCheckedPassword = await this.hashingProvider.comparePasswords(signInDto.password, (await user).password)
        } catch (error) {
            throw new RequestTimeoutException(error, {
                description: 'error  connecting to the database'
            })
        }

        if (!isCheckedPassword) {
            throw new UnauthorizedException('email or password is incorrect')
        }
        // login
        return await this.generateTokenProvider.generateTokens(user)
    }
}
