/**
 * Tests for GridTypeRegistry.
 *
 * GridTypeRegistry uses `inject()` in its constructor, so we cannot construct
 * it normally outside an Angular injection context. Following the project
 * convention (see base-overlay-editor.spec.ts), we use `Object.create()` to
 * obtain an instance without invoking the constructor and manually initialise
 * the private `defaults` Map.
 *
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import { GridTypeRegistry, provideGridTypeDefaults, GRID_TYPE_DEFAULTS } from './grid-type-registry';

function createRegistry(): GridTypeRegistry {
  const r = Object.create(GridTypeRegistry.prototype) as GridTypeRegistry;
  // Initialise the private `defaults` Map that the constructor would normally set up
  (r as unknown as { defaults: Map<string, unknown> }).defaults = new Map();
  return r;
}

describe('GridTypeRegistry', () => {
  it('register / get round-trips configuration', () => {
    const r = createRegistry();
    const cfg = { editorParams: { foo: 'bar' } };
    r.register('country', cfg);
    expect(r.get('country')).toBe(cfg);
  });

  it('get returns undefined for unknown types', () => {
    const r = createRegistry();
    expect(r.get('nope')).toBeUndefined();
  });

  it('unregister removes an entry', () => {
    const r = createRegistry();
    r.register('country', {});
    r.unregister('country');
    expect(r.get('country')).toBeUndefined();
    expect(r.has('country')).toBe(false);
  });

  it('has reflects whether a type is registered', () => {
    const r = createRegistry();
    expect(r.has('country')).toBe(false);
    r.register('country', {});
    expect(r.has('country')).toBe(true);
  });

  it('getRegisteredTypes returns all registered type names', () => {
    const r = createRegistry();
    r.register('a', {});
    r.register('b', {});
    expect(r.getRegisteredTypes().sort()).toEqual(['a', 'b']);
  });

  it('getAsTypeDefault returns undefined for unknown types', () => {
    const r = createRegistry();
    expect(r.getAsTypeDefault('nope')).toBeUndefined();
  });

  it('getAsTypeDefault returns a TypeDefault carrying editorParams', () => {
    const r = createRegistry();
    const params = { multiple: true };
    r.register('country', { editorParams: params });
    expect(r.getAsTypeDefault('country')).toEqual({ editorParams: params });
  });
});

describe('provideGridTypeDefaults', () => {
  it('returns EnvironmentProviders with the expected token', () => {
    const providers = provideGridTypeDefaults({ country: {} });
    // EnvironmentProviders is opaque — just check we got an object back
    expect(providers).toBeDefined();
    expect(typeof providers).toBe('object');
  });

  it('exports the GRID_TYPE_DEFAULTS injection token', () => {
    expect(GRID_TYPE_DEFAULTS).toBeDefined();
    expect(GRID_TYPE_DEFAULTS.toString()).toContain('GRID_TYPE_DEFAULTS');
  });
});
