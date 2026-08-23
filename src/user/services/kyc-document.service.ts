import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import { PrivacyEncryptionService } from '../../privacy/services/privacy-encryption.service';
import {
  KycDocument,
  KycDocumentStatus,
  KycDocumentType,
} from '../entities/kyc-document.entity';
import {
  KycVerificationStatus,
  UserProfile,
} from '../entities/user-profile.entity';

/**
 * Minimum allowed document size (1 KB) — rejects obviously-empty uploads.
 */
const MIN_DOC_SIZE = 1_024;

/**
 * Maximum allowed document size (10 MB).
 */
const MAX_DOC_SIZE = 10 * 1024 * 1024;

@Injectable()
export class KycDocumentService {
  private readonly logger = new Logger(KycDocumentService.name);

  constructor(
    @InjectRepository(KycDocument)
    private readonly kycDocRepo: Repository<KycDocument>,

    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,

    private readonly encryptionService: PrivacyEncryptionService,
  ) {}

  // ─── Upload & Encrypt ─────────────────────────────────────────────────

  /**
   * Encrypts a KYC document buffer with AES-256-GCM and stores the
   * ciphertext, nonce, and auth tag in the database. The user's KYC
   * status is moved to PENDING if it was previously NONE.
   */
  async uploadDocument(
    userId: string,
    fileBuffer: Buffer,
    documentType: KycDocumentType,
    originalFilename?: string,
    mimeType?: string,
  ): Promise<KycDocument> {
    this.validateFileBuffer(fileBuffer);

    // Compute integrity hash before encryption
    const contentHash = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest('hex');

    // Generate a random per-document AES key and encrypt the document
    const documentKey = crypto.randomBytes(32);
    const { ciphertext, nonce, tag } =
      this.encryptionService.encrypt(fileBuffer, documentKey);

    // Encrypt the document key itself with the server master key
    const masterKey = this.getMasterKey();
    const {
      ciphertext: encKeyCiphertext,
      nonce: encKeyNonce,
      tag: encKeyTag,
    } = this.encryptionService.encrypt(documentKey.toString('hex'), masterKey);
    const encryptedKey = `${encKeyCiphertext}:${encKeyNonce}:${encKeyTag}`;

    const doc = this.kycDocRepo.create({
      userId,
      documentType,
      encryptedData: ciphertext,
      encryptionNonce: nonce,
      encryptionTag: tag,
      encryptedKey,
      originalFilename,
      mimeType,
      fileSizeBytes: fileBuffer.length,
      contentHash,
      status: KycDocumentStatus.PENDING,
    });

    const saved = await this.kycDocRepo.save(doc);

    // Transition user KYC status → PENDING if currently NONE
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (profile && profile.kycStatus === KycVerificationStatus.NONE) {
      profile.kycStatus = KycVerificationStatus.PENDING;
      await this.profileRepo.save(profile);
    }

    this.logger.log(
      `KYC document uploaded for user ${userId}: type=${documentType}, size=${fileBuffer.length}`,
    );

    return saved;
  }

  // ─── Review (Admin) ───────────────────────────────────────────────────

  /**
   * Allows a KYC operator to approve or reject a document. If all
   * documents for the user are approved the profile KYC status is
   * moved to APPROVED; if any are rejected it becomes REJECTED.
   */
  async reviewDocument(
    documentId: string,
    status: KycDocumentStatus,
    reviewerId: string,
    notes?: string,
  ): Promise<KycDocument> {
    const doc = await this.kycDocRepo.findOne({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundException(`KYC document ${documentId} not found`);
    }

    if (doc.status !== KycDocumentStatus.PENDING) {
      throw new ConflictException(
        `Document ${documentId} has already been ${doc.status}`,
      );
    }

    doc.status = status;
    doc.reviewedBy = reviewerId;
    if (status === KycDocumentStatus.REJECTED) {
      doc.rejectionReason = notes ?? undefined;
    }

    const saved = await this.kycDocRepo.save(doc);

    // Recompute aggregate KYC status for the user
    await this.recomputeKycStatus(doc.userId);

    this.logger.log(
      `KYC document ${documentId} reviewed by ${reviewerId}: ${status}`,
    );

    return saved;
  }

  // ─── Read ─────────────────────────────────────────────────────────────

  async getDocumentsForUser(userId: string): Promise<KycDocument[]> {
    return this.kycDocRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getDocumentById(documentId: string): Promise<KycDocument> {
    const doc = await this.kycDocRepo.findOne({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundException(`KYC document ${documentId} not found`);
    }
    return doc;
  }

  /**
   * Decrypts and returns the raw document buffer. Only accessible by
   * the document owner or a KYC operator.
   */
  async getDecryptedDocument(
    documentId: string,
    requesterId: string,
  ): Promise<{ buffer: Buffer; mimeType?: string; filename?: string }> {
    const doc = await this.getDocumentById(documentId);

    if (doc.userId !== requesterId) {
      throw new ForbiddenException(
        'You can only access your own KYC documents',
      );
    }

    // Decrypt the per-document key with the server master key
    const [encKeyCiphertext, encKeyNonce, encKeyTag] = doc.encryptedKey.split(':');
    const masterKey = this.getMasterKey();
    const decryptionKeyHex = this.encryptionService.decrypt(
      encKeyCiphertext,
      masterKey,
      encKeyNonce,
      encKeyTag,
    );
    const decryptionKey = Buffer.from(decryptionKeyHex, 'hex');

    const plaintext = this.encryptionService.decrypt(
      doc.encryptedData,
      decryptionKey,
      doc.encryptionNonce,
      doc.encryptionTag,
    );

    return {
      buffer: Buffer.from(plaintext, 'hex'),
      mimeType: doc.mimeType,
      filename: doc.originalFilename,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  /**
   * Returns the server-side master encryption key used to wrap
   * per-document keys. In production this should come from a KMS;
   * for now we derive it from an env variable.
   */
  private getMasterKey(): Buffer {
    const secret = process.env.KYC_ENCRYPTION_MASTER_KEY || 'swaptrade-dev-master-key-change-in-production';
    return crypto.scryptSync(secret, 'kyc-doc-salt', 32);
  }

  private validateFileBuffer(buffer: Buffer): void {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Uploaded file is empty');
    }
    if (buffer.length < MIN_DOC_SIZE) {
      throw new BadRequestException(
        `File too small: minimum ${MIN_DOC_SIZE} bytes`,
      );
    }
    if (buffer.length > MAX_DOC_SIZE) {
      throw new BadRequestException(
        `File too large: maximum ${MAX_DOC_SIZE} bytes`,
      );
    }
  }

  /**
   * Recompute the aggregate KYC verification status from all documents
   * and persist it to the user profile.
   */
  private async recomputeKycStatus(userId: string): Promise<void> {
    const docs = await this.kycDocRepo.find({ where: { userId } });

    let newStatus: KycVerificationStatus;

    if (docs.length === 0) {
      newStatus = KycVerificationStatus.NONE;
    } else if (docs.every((d) => d.status === KycDocumentStatus.APPROVED)) {
      newStatus = KycVerificationStatus.APPROVED;
    } else if (
      docs.some((d) => d.status === KycDocumentStatus.REJECTED)
    ) {
      newStatus = KycVerificationStatus.REJECTED;
    } else {
      // At least one pending or all are approved mixed with pending
      newStatus = KycVerificationStatus.UNDER_REVIEW;
    }

    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (profile) {
      profile.kycStatus = newStatus;
      await this.profileRepo.save(profile);
    }
  }
}
