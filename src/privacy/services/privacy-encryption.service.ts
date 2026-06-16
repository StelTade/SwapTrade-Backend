import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as sodium from 'libsodium-wrappers';

@Injectable()
export class PrivacyEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly autoTagLength = 16;
  private readonly nonceLength = 12; // 96 bits for GCM

  /**
   * Initialize libsodium library
   */
  async initialize(): Promise<void> {
    await sodium.ready;
  }

  /**
   * Derive encryption key from password using PBKDF2
   * @param password User password
   * @param salt Random salt
   * @param iterations Number of iterations (default: 100,000)
   * @returns Derived key
   */
  deriveKey(
    password: string,
    salt: Buffer = this.generateRandomBytes(32),
    iterations: number = 100000,
  ): { key: Buffer; salt: Buffer } {
    const key = crypto.pbkdf2Sync(password, salt, iterations, this.keyLength, 'sha256');
    return { key, salt };
  }

  /**
   * Generate cryptographically secure random bytes
   * @param length Number of bytes to generate
   * @returns Random bytes
   */
  generateRandomBytes(length: number): Buffer {
    return crypto.randomBytes(length);
  }

  /**
   * Generate random nonce for GCM
   * @returns Random nonce (96 bits)
   */
  generateNonce(): Buffer {
    return crypto.randomBytes(this.nonceLength);
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param plaintext Data to encrypt
   * @param key Encryption key (32 bytes for AES-256)
   * @param nonce Optional nonce (if not provided, generates random)
   * @returns Object with encrypted data, nonce, and auth tag
   */
  encrypt(
    plaintext: string | Buffer,
    key: Buffer,
    nonce?: Buffer,
  ): {
    ciphertext: string;
    nonce: string;
    tag: string;
  } {
    try {
      if (key.length !== this.keyLength) {
        throw new BadRequestException(`Key must be ${this.keyLength} bytes (256 bits)`);
      }

      const usedNonce = nonce || this.generateNonce();
      const cipher = crypto.createCipheriv(this.algorithm, key, usedNonce);
      
      let encrypted: string;
      if (typeof plaintext === 'string') {
        encrypted = cipher.update(plaintext, 'utf8', 'hex');
      } else {
        encrypted = cipher.update(plaintext, undefined, 'hex');
      }
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();

      return {
        ciphertext: encrypted,
        nonce: usedNonce.toString('base64'),
        tag: tag.toString('base64'),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param ciphertext Encrypted data (hex)
   * @param key Decryption key
   * @param nonce Nonce used during encryption (base64)
   * @param tag Authentication tag (base64)
   * @returns Decrypted plaintext
   */
  decrypt(
    ciphertext: string,
    key: Buffer,
    nonce: string,
    tag: string,
  ): string {
    try {
      if (key.length !== this.keyLength) {
        throw new BadRequestException(`Key must be ${this.keyLength} bytes (256 bits)`);
      }

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        key,
        Buffer.from(nonce, 'base64'),
      );

      decipher.setAuthTag(Buffer.from(tag, 'base64'));

      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Generate HMAC for integrity verification
   * @param data Data to hash
   * @param key HMAC key
   * @returns HMAC hash (hex)
   */
  generateHMAC(data: string | Buffer, key: Buffer): string {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * Verify HMAC
   * @param data Original data
   * @param hmac Provided HMAC
   * @param key HMAC key
   * @returns True if valid, false otherwise
   */
  verifyHMAC(data: string | Buffer, hmac: string, key: Buffer): boolean {
    const computed = this.generateHMAC(data, key);
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(hmac, 'hex'),
    );
  }

  /**
   * Generate cryptographic hash (SHA-256)
   * @param data Data to hash
   * @returns Hash (hex)
   */
  hash(data: string | Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Hash buffer output (for privacy - hashing IDs)
   * @param data Data to hash
   * @returns Hash (hex)
   */
  hashBuffer(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Encrypt with automatic key derivation
   * @param plaintext Data to encrypt
   * @param password Password for key derivation
   * @returns Encrypted data with salt, nonce, and tag
   */
  encryptWithPassword(plaintext: string | Buffer, password: string): {
    ciphertext: string;
    salt: string;
    nonce: string;
    tag: string;
  } {
    const { key, salt } = this.deriveKey(password);
    const { ciphertext, nonce, tag } = this.encrypt(plaintext, key);

    return {
      ciphertext,
      salt: salt.toString('base64'),
      nonce,
      tag,
    };
  }

  /**
   * Decrypt with automatic key derivation
   * @param ciphertext Encrypted data
   * @param password Password for key derivation
   * @param salt Salt used during encryption
   * @param nonce Nonce used during encryption
   * @param tag Authentication tag
   * @returns Decrypted plaintext
   */
  decryptWithPassword(
    ciphertext: string,
    password: string,
    salt: string,
    nonce: string,
    tag: string,
  ): string {
    const { key } = this.deriveKey(password, Buffer.from(salt, 'base64'));
    return this.decrypt(ciphertext, key, nonce, tag);
  }

  /**
   * Generate a master encryption key for the server
   * @returns 256-bit key (hex)
   */
  generateMasterKey(): string {
    return this.generateRandomBytes(this.keyLength).toString('hex');
  }

  /**
   * Create a deterministic hash for anonymization
   * @param input Input to hash
   * @param salt Optional salt for domain separation
   * @returns Base64 encoded hash
   */
  createAnonymousHash(input: string, salt: string = 'default'): string {
    const combined = `${salt}:${input}`;
    return this.hash(combined);
  }
}