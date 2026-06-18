import { Test, TestingModule } from '@nestjs/testing';
import { PrivacyEncryptionService } from '../services/privacy-encryption.service';

describe('PrivacyEncryptionService', () => {
  let service: PrivacyEncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrivacyEncryptionService],
    }).compile();

    service = module.get<PrivacyEncryptionService>(PrivacyEncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encryption and decryption', () => {
    it('should encrypt and decrypt data round-trip', () => {
      const plaintext = 'Hello, Private World!';
      const key = service.generateRandomBytes(32);

      const { ciphertext, nonce, tag } = service.encrypt(plaintext, key);

      expect(ciphertext).toBeDefined();
      expect(nonce).toBeDefined();
      expect(tag).toBeDefined();

      const decrypted = service.decrypt(ciphertext, key, nonce, tag);
      expect(decrypted).toBe(plaintext);
    });

    it('should generate different ciphertexts for same plaintext (due to random nonce)', () => {
      const plaintext = 'Same message';
      const key = service.generateRandomBytes(32);

      const result1 = service.encrypt(plaintext, key);
      const result2 = service.encrypt(plaintext, key);

      expect(result1.ciphertext).not.toBe(result2.ciphertext);
      expect(result1.nonce).not.toBe(result2.nonce);
    });

    it('should fail to decrypt with wrong key', () => {
      const plaintext = 'Secret data';
      const key = service.generateRandomBytes(32);
      const wrongKey = service.generateRandomBytes(32);

      const { ciphertext, nonce, tag } = service.encrypt(plaintext, key);

      expect(() => service.decrypt(ciphertext, wrongKey, nonce, tag)).toThrow();
    });

    it('should fail to decrypt with tampered ciphertext', () => {
      const plaintext = 'Important data';
      const key = service.generateRandomBytes(32);

      const { ciphertext, nonce, tag } = service.encrypt(plaintext, key);
      const tamperedCiphertext =
        ciphertext.substring(0, ciphertext.length - 2) + 'FF';

      expect(() =>
        service.decrypt(tamperedCiphertext, key, nonce, tag),
      ).toThrow();
    });
  });

  describe('key derivation', () => {
    it('should derive consistent keys from same password and salt', () => {
      const password = 'my-secure-password';
      const salt = service.generateRandomBytes(32);

      const result1 = service.deriveKey(password, salt);
      const result2 = service.deriveKey(password, salt);

      expect(result1.key.toString('hex')).toBe(result2.key.toString('hex'));
      expect(result1.salt.toString('hex')).toBe(result2.salt.toString('hex'));
    });

    it('should derive different keys from different passwords', () => {
      const salt = service.generateRandomBytes(32);

      const result1 = service.deriveKey('password1', salt);
      const result2 = service.deriveKey('password2', salt);

      expect(result1.key.toString('hex')).not.toBe(result2.key.toString('hex'));
    });
  });

  describe('HMAC functionality', () => {
    it('should generate and verify valid HMAC', () => {
      const data = 'data to verify';
      const key = service.generateRandomBytes(32);

      const hmac = service.generateHMAC(data, key);
      const isValid = service.verifyHMAC(data, hmac, key);

      expect(isValid).toBe(true);
    });

    it('should reject invalid HMAC', () => {
      const data = 'data to verify';
      const key = service.generateRandomBytes(32);
      const wrongKey = service.generateRandomBytes(32);

      const hmac = service.generateHMAC(data, key);
      const isValid = service.verifyHMAC(data, hmac, wrongKey);

      expect(isValid).toBe(false);
    });

    it('should reject tampered data', () => {
      const data = 'original data';
      const tampered = 'modified data';
      const key = service.generateRandomBytes(32);

      const hmac = service.generateHMAC(data, key);
      const isValid = service.verifyHMAC(tampered, hmac, key);

      expect(isValid).toBe(false);
    });
  });

  describe('hashing', () => {
    it('should generate consistent SHA-256 hashes', () => {
      const data = 'consistent data';

      const hash1 = service.hash(data);
      const hash2 = service.hash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = service.hash('data1');
      const hash2 = service.hash('data2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('random number generation', () => {
    it('should generate random bytes', () => {
      const bytes1 = service.generateRandomBytes(32);
      const bytes2 = service.generateRandomBytes(32);

      expect(bytes1).toHaveLength(32);
      expect(bytes2).toHaveLength(32);
      expect(bytes1.toString('hex')).not.toBe(bytes2.toString('hex'));
    });

    it('should generate valid nonce', () => {
      const nonce = service.generateNonce();

      expect(nonce).toHaveLength(12); // 96 bits = 12 bytes
    });
  });

  describe('password-based encryption', () => {
    it('should encrypt and decrypt with password', () => {
      const plaintext = 'Secret message';
      const password = 'my-secure-password';

      const encrypted = service.encryptWithPassword(plaintext, password);
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.nonce).toBeDefined();
      expect(encrypted.tag).toBeDefined();

      const decrypted = service.decryptWithPassword(
        encrypted.ciphertext,
        password,
        encrypted.salt,
        encrypted.nonce,
        encrypted.tag,
      );

      expect(decrypted).toBe(plaintext);
    });

    it('should fail with wrong password', () => {
      const plaintext = 'Secret message';
      const password = 'correct-password';
      const wrongPassword = 'wrong-password';

      const encrypted = service.encryptWithPassword(plaintext, password);

      expect(() =>
        service.decryptWithPassword(
          encrypted.ciphertext,
          wrongPassword,
          encrypted.salt,
          encrypted.nonce,
          encrypted.tag,
        ),
      ).toThrow();
    });
  });

  describe('anonymization', () => {
    it('should create consistent anonymous hashes', () => {
      const input = 'user123';
      const salt = 'privacy-salt';

      const hash1 = service.createAnonymousHash(input, salt);
      const hash2 = service.createAnonymousHash(input, salt);

      expect(hash1).toBe(hash2);
    });

    it('should create different hashes for different salts', () => {
      const input = 'user123';

      const hash1 = service.createAnonymousHash(input, 'salt1');
      const hash2 = service.createAnonymousHash(input, 'salt2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('error handling', () => {
    it('should throw on invalid key length', () => {
      const shortKey = Buffer.from('short');
      const plaintext = 'data';

      expect(() => service.encrypt(plaintext, shortKey)).toThrow();
    });

    it('should throw on decryption with invalid key length', () => {
      const key = service.generateRandomBytes(32);
      const { ciphertext, nonce, tag } = service.encrypt('data', key);

      const shortKey = Buffer.from('short');

      expect(() => service.decrypt(ciphertext, shortKey, nonce, tag)).toThrow();
    });
  });
});
