import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CredentialStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

@Entity()
export class VerifiableCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  did: string; // The user's DID

  @Column()
  issuerDid: string; // The issuer DID (e.g., Compliance Authority)

  @Column()
  credentialType: string; // "KYC_CLEARED", "OVER_18"

  @Column({ type: 'text' })
  encryptedPayload: string; // Secure payload with zero-knowledge capacity

  @Column({ type: 'varchar', default: CredentialStatus.ACTIVE })
  status: CredentialStatus;

  @CreateDateColumn()
  issuedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
