import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycRecord } from './entities/kyc-records.entity';
import { KycGuard } from './guards/kyc.guards';
import { KycRolesGuard } from './guards/kyc-roles.guards';
import { KycStateMachineService } from './kyc-state-machine.service';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';

@Module({
  imports: [TypeOrmModule.forFeature([KycRecord])],
  controllers: [KycController],
  providers: [KycService, KycStateMachineService, KycGuard, KycRolesGuard],
  exports: [KycService],
})
export class KycModule {}
