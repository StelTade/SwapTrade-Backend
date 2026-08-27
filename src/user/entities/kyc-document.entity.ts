import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum KycDocumentType {
  PASSPORT = 'passport',
  NATIONAL_ID = 'national_id',
  DRIVER_LICENSE = 'driver_license',
  UTILITY_BILL = 'utility_bill',
  BANK_STATEMENT = 'bank_statement',
  SELFIE = 'selfie',
  OTHER = 'other',
}

export enum KycDocumentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Stores encrypted KYC document references.
 *
 * The actual document bytes are encrypted at rest using AES-256-GCM
 * (via PrivacyEncryptionService) and stored as a hex ciphertext blob
 * together with its nonce and auth tag. The per-document encryption key
 * is itself encrypted with a server-side master key and stored in
 * encryptedKey.
 */
@Entity('kyc_documents')
@Index(['userId', 'documentType'])
@Index(['userId', 'status'])
export class KycDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({ type: 'varchar' })
  documentType: KycDocumentType;

  @Column({ type: 'varchar', default: KycDocumentStatus.PENDING })
  status: KycDocumentStatus;

  /**
   * AES-256-GCM ciphertext of the original document buffer (hex-encoded).
   */
  @Column({ type: 'text' })
  encryptedData: string;

  /**
   * Base64-encoded GCM nonce used during encryption.
   */
  @Column({ type: 'varchar' })
  encryptionNonce: string;

  /**
   * Base64-encoded GCM authentication tag.
   */
  @Column({ type: 'varchar' })
  encryptionTag: string;

  /** Original filename, useful for display only. */
  @Column({ type: 'varchar', nullable: true })
  originalFilename?: string;

  /** MIME type of the uploaded file. */
  @Column({ type: 'varchar', nullable: true, length: 100 })
  mimeType?: string;

  /** Size in bytes before encryption. */
  @Column({ type: 'int', nullable: true })
  fileSizeBytes?: number;

  /** Optional rejection reason. */
  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  /** ID of the operator who reviewed this document. */
  @Column({ type: 'varchar', nullable: true })
  reviewedBy?: string;

  /**
   * Server-side master-key-encrypted per-document AES key.
   * Format: hex(ciphertext):base64(nonce):base64(tag)
   */
  @Column({ type: 'text' })
  encryptedKey: string;

  /** SHA-256 hash of the original file for integrity verification. */
  @Column({ type: 'varchar', length: 64 })
  contentHash: string;

  // ─── Timestamps ───────────────────────────────────────────────────────
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
