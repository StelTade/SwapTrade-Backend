import { SetMetadata } from '@nestjs/common';
import { AUTH_TYPE_KEY } from '../constants/auth.constant';
import { authTypes } from '../enums/authTypes.enum';

export const Auth = (...authTypes: authTypes[]) => 
    SetMetadata(AUTH_TYPE_KEY, authTypes);
