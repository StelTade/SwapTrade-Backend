import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class HashingProvider {
    // hashing during signUp
    abstract hashPassword(inpPassword: string | Buffer): Promise<string>

    // comparison during signIn
    abstract comparePasswords(password: string, encryPassword: string): Promise<boolean>
}