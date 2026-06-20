import { Injectable } from '@nestjs/common';

/**
 * Identity Provider abstraction — extension point for future wallet-based auth
 * and decentralised identity integrations. No blockchain implementation required.
 */
export interface IdentityProvider {
  readonly name: string;
  resolveDid(did: string): Promise<DidResolution>;
  associate(userId: string, did: string): Promise<WalletAssociation>;
}

export interface DidResolution {
  did: string;
  document: Record<string, unknown>;
  resolvedAt: Date;
}

export interface WalletAssociation {
  userId: string;
  did: string;
  provider: string;
  associatedAt: Date;
}

@Injectable()
export class IdentityDidAbstractionService {
  private readonly providers = new Map<string, IdentityProvider>();
  private readonly associations = new Map<string, WalletAssociation[]>();

  registerProvider(provider: IdentityProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): IdentityProvider | undefined {
    return this.providers.get(name);
  }

  listProviders(): string[] {
    return [...this.providers.keys()];
  }

  async resolveDid(did: string, providerName: string): Promise<DidResolution> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Identity provider '${providerName}' not registered`);
    }
    return provider.resolveDid(did);
  }

  async associateWallet(
    userId: string,
    did: string,
    providerName: string,
  ): Promise<WalletAssociation> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Identity provider '${providerName}' not registered`);
    }
    const assoc = await provider.associate(userId, did);
    const existing = this.associations.get(userId) ?? [];
    this.associations.set(userId, [...existing, assoc]);
    return assoc;
  }

  getWalletAssociations(userId: string): WalletAssociation[] {
    return this.associations.get(userId) ?? [];
  }
}