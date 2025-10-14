export class BlockCache<T> {
  private cache: Map<number, T> = new Map();
  private accessOrder: number[] = [];

  constructor(private maxSize: number) {}

  get(key: number): T | undefined {
    if (this.cache.has(key)) {
      this.touch(key);
      return this.cache.get(key);
    }
    return undefined;
  }

  set(key: number, value: T): void {
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.touch(key);
      return;
    }

    if (this.cache.size >= this.maxSize) {
      this.evict();
    }

    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  has(key: number): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  get size(): number {
    return this.cache.size;
  }

  private touch(key: number): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx > -1) {
      this.accessOrder.splice(idx, 1);
      this.accessOrder.push(key);
    }
  }

  private evict(): void {
    const oldest = this.accessOrder.shift();
    if (oldest !== undefined) {
      this.cache.delete(oldest);
    }
  }
}
