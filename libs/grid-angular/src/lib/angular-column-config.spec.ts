import { describe, expect, it } from 'vitest';
import { isComponentClass } from './angular-column-config';

/**
 * Mock class that looks like an Angular component (has ɵcmp marker).
 */
class MockAngularComponent {
  static ɵcmp = {}; // Angular component marker
}

/**
 * Mock class without Angular decorator marker.
 */
class PlainClass {
  someMethod() {
    return 'value';
  }
}

describe('isComponentClass', () => {
  it('should return true for classes with ɵcmp marker (Angular components)', () => {
    expect(isComponentClass(MockAngularComponent)).toBe(true);
  });

  it('should return true for plain classes (as potential components)', () => {
    // Plain classes are also considered component classes because they could be
    // Angular components - the actual validation happens at instantiation time
    expect(isComponentClass(PlainClass)).toBe(true);
  });

  it('should return false for regular functions', () => {
    function renderer() {
      return document.createElement('span');
    }
    expect(isComponentClass(renderer)).toBe(false);
  });

  it('should return false for arrow functions', () => {
    const renderer = () => document.createElement('div');
    expect(isComponentClass(renderer)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isComponentClass(undefined as unknown)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isComponentClass(null as unknown)).toBe(false);
  });

  it('should return false for plain objects', () => {
    expect(isComponentClass({ value: 'test' })).toBe(false);
  });

  it('should return false for strings', () => {
    expect(isComponentClass('TestComponent' as unknown)).toBe(false);
  });

  it('should return false for numbers', () => {
    expect(isComponentClass(123 as unknown)).toBe(false);
  });

  it('should return false for arrays', () => {
    expect(isComponentClass([] as unknown)).toBe(false);
  });
});
