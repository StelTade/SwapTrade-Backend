import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ProfileController } from './profile.controller';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { LinkedWallet } from './entities/linked-wallet.entity';
import { KycDocument } from './entities/kyc-document.entity';
import { UserBalance } from '../database/entities/user-balance.entity';
import { Auth } from '../auth/entities/auth.entity';
import { AuthModule } from '../auth/auth.module';
import { PrivacyModule } from '../privacy/privacy.module';

import { ProfileService } from './services/profile.service';
import { LinkedWalletService } from './services/linked-wallet.service';
import { KycDocumentService } from './services/kyc-document.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserProfile,
      LinkedWallet,
      KycDocument,
      UserBalance,
      Auth,
    ]),
    AuthModule,
    PrivacyModule,
  ],
  controllers: [UserController, ProfileController],
  providers: [UserService, ProfileService, LinkedWalletService, KycDocumentService],
  exports: [UserService, ProfileService, LinkedWalletService, KycDocumentService],
})
export class UserModule {}
