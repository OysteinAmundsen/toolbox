/**
 * Tests for the internal feature-extensions registries: template bridges and
 * feature-config preprocessors. These are pure module-scoped state mutations
 * with no Angular dependency, so they're tested directly.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GridAdapter } from '../angular-grid-adapter';
import {
  type TemplateBridge,
  type TemplateBridgeContext,
  getFeatureConfigPreprocessor,
  registerFeatureConfigPreprocessor,
  registerTemplateBridge,
  runTemplateBridges,
} from './feature-extensions';

function makeContext(): TemplateBridgeContext {
  return {
    grid: document.createElement('tbw-grid'),
    adapter: {} as GridAdapter,
  };
}

describe('feature-extensions: template bridges', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('runs each registered bridge with the provided context', () => {
    const ctx = makeContext();
    const a = vi.fn();
    const b = vi.fn();
    registerTemplateBridge(a);
    registerTemplateBridge(b);

    runTemplateBridges(ctx);

    expect(a).toHaveBeenCalledWith(ctx);
    expect(b).toHaveBeenCalledWith(ctx);
  });

  it('continues running subsequent bridges when one throws synchronously', () => {
    const thrower: TemplateBridge = () => {
      throw new Error('boom');
    };
    const after = vi.fn();
    registerTemplateBridge(thrower);
    registerTemplateBridge(after);

    runTemplateBridges(makeContext());

    expect(after).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('[tbw-grid-angular] template bridge threw:', expect.any(Error));
  });

  it('logs async rejections without throwing', async () => {
    const error = new Error('async-boom');
    const asyncThrower: TemplateBridge = () => Promise.reject(error);
    registerTemplateBridge(asyncThrower);

    runTemplateBridges(makeContext());
    // Allow the catch handler to flush.
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleSpy).toHaveBeenCalledWith('[tbw-grid-angular] template bridge threw:', error);
  });

  it('runs async bridges that resolve cleanly', async () => {
    const ok = vi.fn(() => Promise.resolve());
    registerTemplateBridge(ok);

    runTemplateBridges(makeContext());
    await Promise.resolve();

    expect(ok).toHaveBeenCalledTimes(1);
  });
});

describe('feature-extensions: config preprocessors', () => {
  it('returns undefined when no preprocessor is registered for a feature', () => {
    expect(getFeatureConfigPreprocessor('__never-registered__' as never)).toBeUndefined();
  });

  it('registers a preprocessor and retrieves it by feature name', () => {
    const fn = vi.fn((cfg) => cfg);
    registerFeatureConfigPreprocessor('__test-feature-a__' as never, fn);

    const retrieved = getFeatureConfigPreprocessor('__test-feature-a__' as never);
    expect(retrieved).toBe(fn);
  });

  it('overwrites previously-registered preprocessors for the same feature (last-wins)', () => {
    const first = vi.fn();
    const second = vi.fn();
    registerFeatureConfigPreprocessor('__test-feature-b__' as never, first);
    registerFeatureConfigPreprocessor('__test-feature-b__' as never, second);

    expect(getFeatureConfigPreprocessor('__test-feature-b__' as never)).toBe(second);
  });

  it('passes the config and adapter through to the preprocessor when invoked', () => {
    const fn = vi.fn((cfg, adapter) => ({ wrapped: cfg, adapter }));
    registerFeatureConfigPreprocessor('__test-feature-c__' as never, fn);

    const adapter = {} as GridAdapter;
    const config = { foo: 'bar' };
    const result = getFeatureConfigPreprocessor('__test-feature-c__' as never)?.(config, adapter);

    expect(fn).toHaveBeenCalledWith(config, adapter);
    expect(result).toEqual({ wrapped: config, adapter });
  });
});
