import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearFeaturePropKeys, getFeaturePropKeys, registerFeaturePropKey } from './feature-prop-keys';
import type { FeatureName } from './feature-registry';

// Snapshot the pre-registered built-in keys so we can restore them after the
// test suite — `<TbwGrid>` depends on the registry being fully populated.
let builtinSnapshot: readonly FeatureName[] = [];

describe('feature-prop-keys registry', () => {
  beforeEach(() => {
    if (builtinSnapshot.length === 0) {
      builtinSnapshot = getFeaturePropKeys().slice();
    }
    clearFeaturePropKeys();
  });

  afterEach(() => {
    clearFeaturePropKeys();
    for (const key of builtinSnapshot) {
      registerFeaturePropKey(key);
    }
  });

  it('returns an empty array when no keys are registered', () => {
    expect(getFeaturePropKeys()).toEqual([]);
  });

  it('registers a single key and returns it', () => {
    registerFeaturePropKey('selection');
    expect(getFeaturePropKeys()).toEqual(['selection']);
  });

  it('preserves registration order across multiple registrations', () => {
    registerFeaturePropKey('selection');
    registerFeaturePropKey('editing');
    registerFeaturePropKey('filtering');
    expect(getFeaturePropKeys()).toEqual(['selection', 'editing', 'filtering']);
  });

  it('treats re-registering the same key as a no-op (no duplicates)', () => {
    registerFeaturePropKey('selection');
    registerFeaturePropKey('editing');
    registerFeaturePropKey('selection');
    expect(getFeaturePropKeys()).toEqual(['selection', 'editing']);
  });

  it('returns a frozen array snapshot that does not mutate the registry', () => {
    registerFeaturePropKey('selection');
    const snapshot = getFeaturePropKeys();
    expect(() => (snapshot as FeatureName[]).push('selection')).toThrow();
    expect(getFeaturePropKeys()).toEqual(['selection']);
  });

  it('clear empties the registry', () => {
    registerFeaturePropKey('selection');
    registerFeaturePropKey('editing');
    clearFeaturePropKeys();
    expect(getFeaturePropKeys()).toEqual([]);
  });
});

describe('feature-prop-keys built-in pre-registration', () => {
  it('pre-registers all Vue built-in feature prop names at module load', () => {
    const keys = builtinSnapshot.length > 0 ? builtinSnapshot : getFeaturePropKeys();
    expect(keys).toContain('selection');
    expect(keys).toContain('editing');
    expect(keys).toContain('filtering');
    expect(keys).toContain('multiSort');
    expect(keys).toContain('masterDetail');
    expect(keys).toContain('responsive');
    expect(keys).toContain('tooltip');
    expect(new Set(keys).size).toBe(keys.length);
  });
});
