import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { SignInDto } from '../dtos/userDto';
import { SignInProvider } from './sign-in.provider';
import { RefreshTokensProvider } from './refresh-tokens.provider';
import { RefreshTokenDto } from '../dtos/refreshTokenDto';
import { UserService } from 'src/user/provider/user-services.service';

@Injectable()
export class AuthService {
    verifyEmail: any;
    register: any;
    
    constructor(
        /* 
         * injecting user service
         */
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,

        /* 
         * inject signInProvider
         */
        private readonly signInProvider: SignInProvider,

        /* 
         *inject refreshTokenProvider
         */
         private readonly refreshTokensProvider: RefreshTokensProvider
    ) {}

    public async SignIn(signInDto: SignInDto) {
        return await this.signInProvider.SignIn(signInDto)
    }

    public refreshToken(refreshTokenDto: RefreshTokenDto) {
        return this.refreshTokensProvider.refreshTokens(refreshTokenDto)
    }    

}
