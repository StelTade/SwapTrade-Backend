/**
 * Base factory class for generating test data
 */
export abstract class BaseFactory<T> {
  /**
   * Create a single entity instance
   * @param overrides - Optional properties to override in the generated entity
   */
  abstract create(overrides?: Partial<T>): Promise<T>;

  /**
   * Create multiple entity instances
   * @param count - Number of entities to create
   * @param overrides - Optional properties to override in all generated entities
   */
  async createMany(count: number, overrides?: Partial<T>): Promise<T[]> {
    const arr: T[] = [];
    for (let i = 0; i < count; i++) {
      arr.push(await this.create(overrides));
    }
    return arr;
  }
}
