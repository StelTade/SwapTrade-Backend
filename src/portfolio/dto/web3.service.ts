import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';

export enum ChainId {
  ETHEREUM = 1,
  GOERLI = 5,
  POLYGON = 137,
  MUMBAI = 80001,
  BSC = 56,
  LOCALHOST = 1337,
}

export interface ChainConfig {
  name: string;
  rpcUrl: string;
  chainId: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  explorerUrl: string;
}

@Injectable()
export class Web3Service implements OnModuleInit {
  private readonly logger = new Logger(Web3Service.name);
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  private chains: Map<number, ChainConfig> = new Map();

  onModuleInit() {
    this.initializeChains();
  }

  private initializeChains() {
    const supportedChains: ChainConfig[] = [
      {
        name: 'Ethereum Mainnet',
        rpcUrl: process.env.BLOCKCHAIN_ETH_RPC || 'https://mainnet.infura.io/v3/YOUR_KEY',
        chainId: ChainId.ETHEREUM,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        explorerUrl: 'https://etherscan.io',
      },
      {
        name: 'Polygon Mainnet',
        rpcUrl: process.env.BLOCKCHAIN_POLYGON_RPC || 'https://polygon-rpc.com',
        chainId: ChainId.POLYGON,
        nativeCurrency: { name: 'Matic', symbol: 'MATIC', decimals: 18 },
        explorerUrl: 'https://polygonscan.com',
      },
      {
        name: 'Localhost',
        rpcUrl: process.env.BLOCKCHAIN_LOCAL_RPC || 'http://127.0.0.1:8545',
        chainId: ChainId.LOCALHOST,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        explorerUrl: '',
      },
    ];

    for (const chain of supportedChains) {
      this.chains.set(chain.chainId, chain);
      try {
        const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chain.chainId);
        this.providers.set(chain.chainId, provider);
        this.logger.log(`Initialized provider for ${chain.name} (${chain.chainId})`);
      } catch (error) {
        this.logger.error(`Failed to initialize provider for ${chain.name}: ${error.message}`);
      }
    }
  }

  getProvider(chainId: number): ethers.JsonRpcProvider {
    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`Provider not found for chain ID ${chainId}`);
    }
    return provider;
  }

  getChainConfig(chainId: number): ChainConfig {
    return this.chains.get(chainId);
  }

  getContract(address: string, abi: any, chainId: number): ethers.Contract {
    const provider = this.getProvider(chainId);
    return new ethers.Contract(address, abi, provider);
  }
}