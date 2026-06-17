import { PrivacyEncryptionService } from '../services/privacy-encryption.service';
import { PrivacyZKPService } from '../services/privacy-zkp.service';

/**
 * Performance benchmarks for privacy-preserving trading
 * These tests measure throughput and latency of various operations
 */

describe('Privacy Performance Benchmarks', () => {
  let encryptionService: PrivacyEncryptionService;
  let zkpService: PrivacyZKPService;

  beforeEach(() => {
    encryptionService = new PrivacyEncryptionService();
    zkpService = new PrivacyZKPService();
  });

  describe('Encryption Performance', () => {
    it('should encrypt 100 orders within acceptable time', () => {
      const key = encryptionService.generateRandomBytes(32);
      const orderData = 'BTC_USD|LIMIT|1.5|50000|1704067200000';

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        encryptionService.encrypt(orderData, key);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / 100;

      console.log(`\nEncryption Benchmark:`);
      console.log(`  Total time for 100 orders: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average per order: ${averageTime.toFixed(2)}ms`);
      console.log(
        `  Throughput: ${(100 / (totalTime / 1000)).toFixed(0)} orders/sec`,
      );

      // Target: < 10ms per order, > 100 orders/sec
      expect(averageTime).toBeLessThan(10);
    });

    it('should decrypt 100 orders within acceptable time', () => {
      const key = encryptionService.generateRandomBytes(32);
      const orderData = 'BTC_USD|LIMIT|1.5|50000|1704067200000';

      // Pre-encrypt test data
      const encrypted = encryptionService.encrypt(orderData, key);

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        encryptionService.decrypt(
          encrypted.ciphertext,
          key,
          encrypted.nonce,
          encrypted.tag,
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / 100;

      console.log(`\nDecryption Benchmark:`);
      console.log(`  Total time for 100 orders: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average per order: ${averageTime.toFixed(2)}ms`);

      expect(averageTime).toBeLessThan(10);
    });

    it('should derive key within acceptable time', () => {
      const password = 'test-password-for-key-derivation';
      const iterations = 10;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        encryptionService.deriveKey(password);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / iterations;

      console.log(`\nKey Derivation Benchmark:`);
      console.log(
        `  Total time for ${iterations} derivations: ${totalTime.toFixed(2)}ms`,
      );
      console.log(`  Average per derivation: ${averageTime.toFixed(2)}ms`);

      // Key derivation should be relatively slow for security
      expect(averageTime).toBeLessThan(500); // < 500ms is acceptable
    });

    it('should generate HMAC for 1000 messages', () => {
      const key = encryptionService.generateRandomBytes(32);
      const message = 'order-data-to-verify-integrity';

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        encryptionService.generateHMAC(message, key);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / 1000;

      console.log(`\nHMAC Generation Benchmark:`);
      console.log(`  Total time for 1000 HMACs: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average per HMAC: ${averageTime.toFixed(3)}ms`);

      expect(averageTime).toBeLessThan(1); // < 1ms per HMAC
    });
  });

  describe('ZKP Performance', () => {
    it('should create 50 balance commitments', () => {
      const balance = '1000000000000000000';

      const startTime = performance.now();

      for (let i = 0; i < 50; i++) {
        zkpService.createBalanceCommitment(balance);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / 50;

      console.log(`\nBalance Commitment Benchmark:`);
      console.log(`  Total time for 50 commitments: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average per commitment: ${averageTime.toFixed(3)}ms`);

      expect(averageTime).toBeLessThan(5);
    });

    it('should generate 20 balance proofs', () => {
      const balance = '1000000000000000000';
      const coefficient = '1';
      const minAmount = '500000000000000000';

      const startTime = performance.now();

      for (let i = 0; i < 20; i++) {
        const challenge = zkpService.generateServerChallenge();
        zkpService.generateBalanceProof(
          balance,
          coefficient,
          minAmount,
          challenge,
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / 20;

      console.log(`\nBalance Proof Generation Benchmark:`);
      console.log(`  Total time for 20 proofs: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average per proof: ${averageTime.toFixed(2)}ms`);

      // ZKP generation is more expensive
      expect(averageTime).toBeLessThan(500);
    });

    it('should verify 100 balance proofs', () => {
      const balance = '1000000000000000000';
      const coefficient = '1';
      const minAmount = '500000000000000000';

      // Pre-generate proofs
      const proofs = [];
      for (let i = 0; i < 100; i++) {
        const challenge = zkpService.generateServerChallenge();
        proofs.push(
          zkpService.generateBalanceProof(
            balance,
            coefficient,
            minAmount,
            challenge,
          ),
        );
      }

      const startTime = performance.now();

      let verified = 0;
      for (const proof of proofs) {
        const challenge = zkpService.generateServerChallenge();
        if (
          zkpService.verifyBalanceProof(
            proof.commitment,
            proof.proof,
            proof.minAmount,
            challenge,
            coefficient,
          )
        ) {
          verified++;
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / 100;

      console.log(`\nBalance Proof Verification Benchmark:`);
      console.log(
        `  Total time for 100 verifications: ${totalTime.toFixed(2)}ms`,
      );
      console.log(`  Average per verification: ${averageTime.toFixed(3)}ms`);
      console.log(
        `  Verification rate: ${(100 / (totalTime / 1000)).toFixed(0)} proofs/sec`,
      );

      expect(averageTime).toBeLessThan(100);
    });

    it('should create 50 range proofs', () => {
      const balance = '5000';
      const minRange = '1000';
      const maxRange = '10000';

      const startTime = performance.now();

      for (let i = 0; i < 50; i++) {
        zkpService.createRangeProof(balance, minRange, maxRange);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / 50;

      console.log(`\nRange Proof Benchmark:`);
      console.log(`  Total time for 50 proofs: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average per proof: ${averageTime.toFixed(3)}ms`);

      expect(averageTime).toBeLessThan(5);
    });
  });

  describe('End-to-end Order Processing', () => {
    it('should process complete private order lifecycle', () => {
      const key = encryptionService.generateRandomBytes(32);
      const orderData = JSON.stringify({
        symbol: 'BTC/USD',
        side: 'BUY',
        quantity: '1.5',
        price: '50000',
        expiration: new Date().toISOString(),
      });

      const startTime = performance.now();

      // 1. Encrypt order
      const { ciphertext, nonce, tag } = encryptionService.encrypt(
        orderData,
        key,
      );

      // 2. Generate HMAC
      const hmac = encryptionService.generateHMAC(ciphertext, key);

      // 3. Create balance commitment
      const commitment = encryptionService.createBalanceCommitment(
        '1000000000000000000',
      );

      // 4. Generate balance proof
      const challenge = zkpService.generateServerChallenge();
      const proof = zkpService.generateBalanceProof(
        '1000000000000000000',
        '1',
        '500000000000000000',
        challenge,
      );

      // 5. Decrypt to verify
      const decrypted = encryptionService.decrypt(ciphertext, key, nonce, tag);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(`\nEnd-to-end Order Processing Benchmark:`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(
        `  Operations completed: Encrypt, HMAC, Commitment, Proof, Decrypt`,
      );

      expect(totalTime).toBeLessThan(1000); // < 1 second for full workflow
      expect(decrypted).toBe(orderData);
    });
  });

  describe('Memory Usage', () => {
    it('should handle large batch of keys efficiently', () => {
      const iterations = 1000;
      const keys = [];

      const startMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        keys.push(encryptionService.generateRandomBytes(32));
      }

      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsed = (endMemory - startMemory) / 1024 / 1024; // Convert to MB

      console.log(`\nMemory Usage Benchmark:`);
      console.log(`  Keys generated: ${iterations}`);
      console.log(`  Memory used: ${memoryUsed.toFixed(2)}MB`);
      console.log(
        `  Average per key: ${((memoryUsed * 1024) / iterations).toFixed(2)}KB`,
      );

      // Should not use excessive memory
      expect(memoryUsed).toBeLessThan(50); // Reasonable upper limit
    });
  });

  describe('Stress Test', () => {
    it('should handle concurrent order encryption', async () => {
      const key = encryptionService.generateRandomBytes(32);
      const orderCount = 100;

      const startTime = performance.now();

      const promises = [];
      for (let i = 0; i < orderCount; i++) {
        promises.push(
          Promise.resolve().then(() => {
            const data = `order-${i}`;
            return encryptionService.encrypt(data, key);
          }),
        );
      }

      await Promise.all(promises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(`\nConcurrent Encryption Stress Test:`);
      console.log(`  Orders processed: ${orderCount}`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(
        `  Throughput: ${(orderCount / (totalTime / 1000)).toFixed(0)} orders/sec`,
      );

      expect(totalTime).toBeLessThan(5000); // Should complete in < 5 seconds
    });
  });
});
