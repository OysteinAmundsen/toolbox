/**
 * Tests for the `provideGrid` combined provider helper.
 *
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import { provideGrid } from './grid-provider';

describe('provideGrid', () => {
  it('is exported as a function', () => {
    expect(typeof provideGrid).toBe('function');
  });

  it('returns environment providers when called with no arguments', () => {
    const result = provideGrid();
    expect(result).toBeDefined();
    // makeEnvironmentProviders returns an object with the EnvironmentProviders brand.
    expect(typeof result).toBe('object');
  });

  it('returns environment providers when called with empty options', () => {
    const result = provideGrid({});
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('returns environment providers when only typeDefaults are provided', () => {
    const result = provideGrid({
      typeDefaults: {
        country: { renderer: () => 'NO' },
      },
    });
    expect(result).toBeDefined();
  });

  it('returns environment providers when only icons are provided', () => {
    const result = provideGrid({
      icons: { sortAsc: '↑', sortDesc: '↓' },
    });
    expect(result).toBeDefined();
  });

  it('returns environment providers when both typeDefaults and icons are provided', () => {
    const result = provideGrid({
      typeDefaults: { country: { renderer: () => 'NO' } },
      icons: { sortAsc: '↑' },
    });
    expect(result).toBeDefined();
  });
});
