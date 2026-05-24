import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearFeatureConfigPreprocessors,
  getFeatureConfigPreprocessor,
  registerFeatureConfigPreprocessor,
} from './feature-config-preprocessors';
import { GridAdapter } from './react-grid-adapter';

describe('feature-config-preprocessors registry', () => {
  afterEach(() => {
    clearFeatureConfigPreprocessors();
  });

  it('returns undefined for an unregistered feature name', () => {
    expect(getFeatureConfigPreprocessor('selection')).toBeUndefined();
  });

  it('returns the registered preprocessor', () => {
    const fn = vi.fn();
    registerFeatureConfigPreprocessor('selection', fn);
    expect(getFeatureConfigPreprocessor('selection')).toBe(fn);
  });

  it('replaces the previous preprocessor when re-registered with the same name', () => {
    const first = vi.fn();
    const second = vi.fn();
    registerFeatureConfigPreprocessor('selection', first);
    registerFeatureConfigPreprocessor('selection', second);
    expect(getFeatureConfigPreprocessor('selection')).toBe(second);
  });

  it('invokes the preprocessor with config and adapter and returns the transformed config', () => {
    const adapter = new GridAdapter();
    const input = { mode: 'cell' };
    registerFeatureConfigPreprocessor('selection', (config) => {
      return { ...(config as Record<string, unknown>), preprocessed: true };
    });
    const out = getFeatureConfigPreprocessor('selection')?.(input, adapter);
    expect(out).toEqual({ mode: 'cell', preprocessed: true });
  });

  it('passes the adapter through to the preprocessor', () => {
    const adapter = new GridAdapter();
    const spy = vi.fn((c) => c);
    registerFeatureConfigPreprocessor('selection', spy);
    getFeatureConfigPreprocessor('selection')?.({}, adapter);
    expect(spy).toHaveBeenCalledWith({}, adapter);
  });

  it('clear removes all registered preprocessors', () => {
    registerFeatureConfigPreprocessor('selection', vi.fn());
    registerFeatureConfigPreprocessor('editing', vi.fn());
    clearFeatureConfigPreprocessors();
    expect(getFeatureConfigPreprocessor('selection')).toBeUndefined();
    expect(getFeatureConfigPreprocessor('editing')).toBeUndefined();
  });
});
