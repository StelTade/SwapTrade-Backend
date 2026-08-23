import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainNetwork } from '../../blockchain/entities/blockchain-transaction.entity';
import { LinkedWallet } from '../entities/linked-wallet.entity';

@Injectable()
export class LinkedWalletService {
  private readonly logger = new Logger(LinkedWalletService.name);

  constructor(
    @InjectRepository(LinkedWallet)
    private readonly walletRepo: Repository<LinkedWallet>,
  ) {}

  // ─── Add Wallet ───────────────────────────────────────────────────────

  async addWallet(
    userId: string,
    address: string,
    chain: BlockchainNetwork = BlockchainNetwork.ETHEREUM,
    label?: string,
    isPrimary = false,
  ): Promise<LinkedWallet> {
    const normalizedAddress = this.normalizeAddress(address, chain);

    // Check for duplicate
    const existing = await this.walletRepo.findOne({
      where: { userId, address: normalizedAddress },
    });
    if (existing) {
      throw new ConflictException(
        `Wallet address ${normalizedAddress} is already linked`,
      );
    }

    // If this is the first wallet, force it to be primary
    const existingCount = await this.walletRepo.count({ where: { userId } });
    if (existingCount === 0) {
      isPrimary = true;
    }

    // If marking as primary, unset any existing primary
    if (isPrimary) {
      await this.unsetPrimaryForUser(userId);
    }

    const wallet = this.walletRepo.create({
      userId,
      address: normalizedAddress,
      chain,
      label,
      isPrimary,
    });

    const saved = await this.walletRepo.save(wallet);
    this.logger.log(
      `Wallet ${normalizedAddress} linked for user ${userId} (primary=${isPrimary})`,
    );

    return saved;
  }

  // ─── Remove Wallet ────────────────────────────────────────────────────

  async removeWallet(walletId: string, userId: string): Promise<void> {
    const wallet = await this.walletRepo.findOne({
      where: { id: walletId, userId },
    });
    if (!wallet) {
      throw new NotFoundException(
        `Wallet ${walletId} not found for user ${userId}`,
      );
    }

    if (wallet.isPrimary) {
      throw new BadRequestException(
        'Cannot remove the primary wallet. Set another wallet as primary first.',
      );
    }

    await this.walletRepo.remove(wallet);
    this.logger.log(
      `Wallet ${wallet.address} removed for user ${userId}`,
    );
  }

  // ─── Set Primary ──────────────────────────────────────────────────────

  async setPrimaryWallet(walletId: string, userId: string): Promise<LinkedWallet> {
    const wallet = await this.walletRepo.findOne({
      where: { id: walletId, userId },
    });
    if (!wallet) {
      throw new NotFoundException(
        `Wallet ${walletId} not found for user ${userId}`,
      );
    }

    if (wallet.isPrimary) {
      return wallet; // Already primary, no-op
    }

    await this.unsetPrimaryForUser(userId);

    wallet.isPrimary = true;
    const saved = await this.walletRepo.save(wallet);

    this.logger.log(
      `Wallet ${wallet.address} set as primary for user ${userId}`,
    );

    return saved;
  }

  // ─── List Wallets ─────────────────────────────────────────────────────

  async getWalletsForUser(userId: string): Promise<LinkedWallet[]> {
    return this.walletRepo.find({
      where: { userId, isActive: true },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  async getPrimaryWallet(userId: string): Promise<LinkedWallet | null> {
    return this.walletRepo.findOne({
      where: { userId, isPrimary: true, isActive: true },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private async unsetPrimaryForUser(userId: string): Promise<void> {
    await this.walletRepo.update(
      { userId, isPrimary: true },
      { isPrimary: false },
    );
  }

  /**
   * Normalize wallet addresses per chain convention.
   * EVM addresses are lowercased; Stellar addresses are kept as-is.
   */
  private normalizeAddress(address: string, chain: BlockchainNetwork): string {
    if (chain === BlockchainNetwork.ETHEREUM || chain === BlockchainNetwork.BSC) {
      return address.toLowerCase();
    }
    return address;
  }
}
