/**
 * Base factory class for generating test data
 */
export abstract class BaseFactory<T> {
  /**
   * Create a single entity instance
   * @param overrides - Optional properties to override in the generated entity
   */
  abstract create(overrides?: Partial<T>): T;

  /**
   * Create multiple entity instances
   * @param count - Number of entities to create
   * @param overrides - Optional properties to override in all generated entities
   */
  createMany(count: number, overrides?: Partial<T>): T[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}
