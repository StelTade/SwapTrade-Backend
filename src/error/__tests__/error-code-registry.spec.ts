import { ErrorCodeRegistry } from '../error-code.registry';

describe('ErrorCodeRegistry', () => {
  it('should get error definition by code', () => {
    const definition = ErrorCodeRegistry.getErrorDefinition(
      'AUTH_TOKEN_EXPIRED_401',
    );

    expect(definition).toBeDefined();
    expect(definition?.code).toBe('AUTH_TOKEN_EXPIRED_401');
    expect(definition?.category).toBe('AUTH');
    expect(definition?.httpStatus).toBe(401);
    expect(definition?.retryable).toBe(false);
  });

  it('should return null for non-existent code', () => {
    const definition =
      ErrorCodeRegistry.getErrorDefinition('NON_EXISTENT_CODE');

    expect(definition).toBeUndefined();
  });

  it('should get all error codes', () => {
    const allCodes = ErrorCodeRegistry.getAllErrorCodes();

    expect(allCodes).toBeDefined();
    expect(Object.keys(allCodes).length).toBeGreaterThan(0);
    expect(allCodes['AUTH_TOKEN_EXPIRED_401']).toBeDefined();
  });

  it('should get error codes by category', () => {
    const authCodes = ErrorCodeRegistry.getErrorCodesByCategory('AUTH');

    expect(authCodes).toBeDefined();
    expect(Object.keys(authCodes).length).toBeGreaterThan(0);
    expect(authCodes['AUTH_TOKEN_EXPIRED_401']).toBeDefined();
  });

  it('should get all categories', () => {
    const categories = ErrorCodeRegistry.getCategories();

    expect(categories).toBeInstanceOf(Array);
    expect(categories).toContain('AUTH');
    expect(categories).toContain('VALIDATION');
  });

  it('should check if error code exists', () => {
    expect(ErrorCodeRegistry.hasErrorCode('AUTH_TOKEN_EXPIRED_401')).toBe(true);
    expect(ErrorCodeRegistry.hasErrorCode('NON_EXISTENT_CODE')).toBe(false);
  });

  it('should get sorted error codes', () => {
    const sortedCodes = ErrorCodeRegistry.getSortedErrorCodes();

    expect(sortedCodes).toBeInstanceOf(Array);
    expect(sortedCodes.length).toBeGreaterThan(0);

    // Check that codes are sorted by category
    const categories = sortedCodes.map((item) => item.definition.category);
    const sortedCategories = [...categories].sort();

    expect(categories).toEqual(sortedCategories);
  });
});
