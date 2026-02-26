import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { Web3Service } from './web3.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private masterWallet: ethers.HDNodeWallet;

  constructor(private readonly web3Service: Web3Service) {
    this.initializeMasterWallet();
  }

  private initializeMasterWallet() {
    const mnemonic = process.env.BLOCKCHAIN_MNEMONIC;
    if (!mnemonic) {
      this.logger.warn('BLOCKCHAIN_MNEMONIC not set. Wallet service operating in limited mode.');
      return;
    }
    try {
      this.masterWallet = ethers.HDNodeWallet.fromPhrase(mnemonic);
    } catch (error) {
      this.logger.error('Failed to initialize master wallet from mnemonic', error);
    }
  }

  deriveWallet(index: number): ethers.HDNodeWallet {
    if (!this.masterWallet) {
      throw new Error('Master wallet not initialized');
    }
    // Standard path for Ethereum: m/44'/60'/0'/0/index
    const path = `m/44'/60'/0'/0/${index}`;
    return this.masterWallet.derivePath(path);
  }

  async getBalance(chainId: number, address: string): Promise<string> {
    const provider = this.web3Service.getProvider(chainId);
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  async sendNativeToken(chainId: number, walletIndex: number, to: string, amount: string): Promise<string> {
    const wallet = this.deriveWallet(walletIndex);
    const provider = this.web3Service.getProvider(chainId);
    const connectedWallet = wallet.connect(provider);

    const tx = await connectedWallet.sendTransaction({
      to,
      value: ethers.parseEther(amount),
    });

    return tx.hash;
  }

  async signMessage(walletIndex: number, message: string): Promise<string> {
    const wallet = this.deriveWallet(walletIndex);
    return wallet.signMessage(message);
  }
}