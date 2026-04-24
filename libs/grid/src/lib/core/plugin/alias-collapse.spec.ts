/**
 * @vitest-environment happy-dom
 *
 * Tests for the alias-collapse pre-pass in `PluginManager.attachAll()` and
 * the `BaseGridPlugin.mergeConfigsFrom()` shallow-merge helper.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseGridPlugin, type GridElement } from './base-plugin';
import { PluginManager } from './plugin-manager';

class FooPlugin extends BaseGridPlugin<{ a?: number; b?: number; cb?: () => void }> {
  readonly name = 'foo';
  protected override get defaultConfig() {
    return {};
  }
}

function makeGrid(): GridElement {
  const el = document.createElement('div');
  el.id = 'g-test';
  return el as unknown as GridElement;
}

describe('PluginManager — alias collapse', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('attaches a single instance when only one is provided', () => {
    const grid = makeGrid();
    const pm = new PluginManager(grid);
    const p = new FooPlugin();
    pm.attachAll([p]);
    expect(pm.getAll().length).toBe(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('collapses duplicate constructors and merges disjoint configs', () => {
    const grid = makeGrid();
    const pm = new PluginManager(grid);
    const a = new FooPlugin({ a: 1 });
    const b = new FooPlugin({ b: 2 });
    pm.attachAll([a, b]);
    expect(pm.getAll().length).toBe(1);
    expect(pm.getAll()[0]).toBe(a);
    // After merge, config should contain both keys
    expect((a as unknown as { config: Record<string, number> }).config.a).toBe(1);
    expect((a as unknown as { config: Record<string, number> }).config.b).toBe(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/TBW023/);
  });

  it('keeps duplicate equal values silently after merge', () => {
    const grid = makeGrid();
    const pm = new PluginManager(grid);
    const a = new FooPlugin({ a: 1 });
    const b = new FooPlugin({ a: 1 });
    expect(() => pm.attachAll([a, b])).not.toThrow();
  });

  it('throws when two instances supply conflicting scalar values', () => {
    const grid = makeGrid();
    const pm = new PluginManager(grid);
    const a = new FooPlugin({ a: 1 });
    const b = new FooPlugin({ a: 2 });
    expect(() => pm.attachAll([a, b])).toThrow(/TBW025|conflicting value for "a"/);
  });

  it('throws when both instances supply different callbacks', () => {
    const grid = makeGrid();
    const pm = new PluginManager(grid);
    const a = new FooPlugin({ cb: () => undefined });
    const b = new FooPlugin({ cb: () => undefined });
    expect(() => pm.attachAll([a, b])).toThrow(/conflicting value for "cb"/);
  });
});
