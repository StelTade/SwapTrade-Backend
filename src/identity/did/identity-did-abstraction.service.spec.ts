import {
  IdentityDidAbstractionService,
  IdentityProvider,
} from './identity-did-abstraction.service';

const makeProvider = (name = 'test-provider'): IdentityProvider => ({
  name,
  resolveDid: jest.fn().mockResolvedValue({
    did: 'did:test:123',
    document: { id: 'did:test:123' },
    resolvedAt: new Date(),
  }),
  associate: jest.fn().mockImplementation((userId, did) =>
    Promise.resolve({
      userId,
      did,
      provider: name,
      associatedAt: new Date(),
    }),
  ),
});

describe('IdentityDidAbstractionService', () => {
  const make = () => {
    const service = new IdentityDidAbstractionService();
    return service;
  };

  it('registers and lists providers', () => {
    const service = make();
    service.registerProvider(makeProvider('stellar'));
    service.registerProvider(makeProvider('ethereum'));
    expect(service.listProviders()).toEqual(
      expect.arrayContaining(['stellar', 'ethereum']),
    );
  });

  it('resolveDid delegates to registered provider', async () => {
    const service = make();
    const provider = makeProvider();
    service.registerProvider(provider);
    const result = await service.resolveDid('did:test:123', 'test-provider');
    expect(result.did).toBe('did:test:123');
    expect(provider.resolveDid).toHaveBeenCalledWith('did:test:123');
  });

  it('resolveDid throws for unknown provider', async () => {
    const service = make();
    await expect(service.resolveDid('did:x:1', 'unknown')).rejects.toThrow(
      "Identity provider 'unknown' not registered",
    );
  });

  it('associateWallet stores association', async () => {
    const service = make();
    service.registerProvider(makeProvider());
    await service.associateWallet('u1', 'did:test:123', 'test-provider');
    const assocs = service.getWalletAssociations('u1');
    expect(assocs).toHaveLength(1);
    expect(assocs[0].did).toBe('did:test:123');
  });

  it('getWalletAssociations returns empty array for unknown user', () => {
    const service = make();
    expect(service.getWalletAssociations('nobody')).toEqual([]);
  });

  it('multiple associations accumulate per user', async () => {
    const service = make();
    service.registerProvider(makeProvider());
    await service.associateWallet('u1', 'did:test:1', 'test-provider');
    await service.associateWallet('u1', 'did:test:2', 'test-provider');
    expect(service.getWalletAssociations('u1')).toHaveLength(2);
  });

  it('getProvider returns undefined for unregistered name', () => {
    const service = make();
    expect(service.getProvider('nope')).toBeUndefined();
  });
});
