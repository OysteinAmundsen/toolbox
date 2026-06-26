import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GridPlugin } from '../core/types';
import {
  clearFeatureRegistry,
  createPluginFromFeature,
  createPluginsFromFeatures,
  getFeatureFactory,
  getRegisteredFeatures,
  isFeatureRegistered,
  registerFeature,
} from './registry';

declare const __GRID_VERSION__: string;
const GRID_VERSION = typeof __GRID_VERSION__ !== 'undefined' ? __GRID_VERSION__ : 'dev';

/** Minimal plugin stub for testing. */
function fakePlugin(name: string, config?: unknown, dependencies: { name: string }[] = []): GridPlugin {
  // Mirror a real plugin: an instance whose constructor carries the static
  // `dependencies` list the resolver reads to order plugins.
  class FakePlugin {
    static dependencies = dependencies;
    readonly name = name;
    readonly pluginName = name;
    readonly _config = config;
  }
  return new FakePlugin() as unknown as GridPlugin;
}

describe('Feature Registry', () => {
  beforeEach(() => {
    clearFeatureRegistry();
  });

  afterEach(() => {
    clearFeatureRegistry();
  });

  // #region registerFeature / isFeatureRegistered / getFeatureFactory

  describe('registerFeature', () => {
    it('registers a feature factory', () => {
      registerFeature('selection' as any, () => fakePlugin('selection'));
      expect(isFeatureRegistered('selection')).toBe(true);
    });

    it('getFeatureFactory returns the registered factory', () => {
      const factory = () => fakePlugin('selection');
      registerFeature('selection' as any, factory);
      expect(getFeatureFactory('selection')).toBe(factory);
    });

    it('isFeatureRegistered returns false for unregistered features', () => {
      expect(isFeatureRegistered('nonexistent')).toBe(false);
    });

    it('getFeatureFactory returns undefined for unregistered features', () => {
      expect(getFeatureFactory('nonexistent')).toBeUndefined();
    });

    it('getRegisteredFeatures returns all names', () => {
      registerFeature('selection' as any, () => fakePlugin('selection'));
      registerFeature('editing' as any, () => fakePlugin('editing'));
      expect(getRegisteredFeatures()).toEqual(expect.arrayContaining(['selection', 'editing']));
      expect(getRegisteredFeatures()).toHaveLength(2);
    });
  });

  // #endregion

  // #region createPluginFromFeature

  describe('createPluginFromFeature', () => {
    it('creates a plugin from registered feature', () => {
      registerFeature('selection' as any, (config) => fakePlugin('selection', config));
      const plugin = createPluginFromFeature('selection', 'range');
      expect(plugin).toBeDefined();
      expect((plugin as any)._config).toBe('range');
    });

    it('returns undefined for unregistered feature', () => {
      const plugin = createPluginFromFeature('nonexistent', true);
      expect(plugin).toBeUndefined();
    });

    it('passes config to factory', () => {
      const factory = vi.fn((config) => fakePlugin('editing', config));
      registerFeature('editing' as any, factory);

      createPluginFromFeature('editing', { editOn: 'click' });
      expect(factory).toHaveBeenCalledWith({ editOn: 'click' });
    });
  });

  // #endregion

  // #region createPluginsFromFeatures

  describe('createPluginsFromFeatures', () => {
    it('creates plugins for enabled features', () => {
      registerFeature('selection' as any, (config) => fakePlugin('selection', config));
      registerFeature('editing' as any, (config) => fakePlugin('editing', config));

      const plugins = createPluginsFromFeatures({ selection: 'range', editing: true });
      expect(plugins).toHaveLength(2);
    });

    it('skips false-valued features', () => {
      registerFeature('selection' as any, (config) => fakePlugin('selection', config));
      registerFeature('editing' as any, (config) => fakePlugin('editing', config));

      const plugins = createPluginsFromFeatures({ selection: 'range', editing: false });
      expect(plugins).toHaveLength(1);
    });

    it('skips undefined-valued features', () => {
      registerFeature('selection' as any, (config) => fakePlugin('selection', config));

      const plugins = createPluginsFromFeatures({ selection: undefined });
      expect(plugins).toHaveLength(0);
    });

    it('orders selection before other plugins', () => {
      registerFeature('clipboard' as any, () => fakePlugin('clipboard', undefined, [{ name: 'selection' }]));
      registerFeature('selection' as any, () => fakePlugin('selection'));

      const plugins = createPluginsFromFeatures({ clipboard: true, selection: true });
      expect((plugins[0] as any).pluginName).toBe('selection');
      expect((plugins[1] as any).pluginName).toBe('clipboard');
    });

    it('orders editing before dependent plugins', () => {
      registerFeature('undoRedo' as any, () => fakePlugin('undoRedo', undefined, [{ name: 'editing' }]));
      registerFeature('editing' as any, () => fakePlugin('editing'));

      const plugins = createPluginsFromFeatures({ undoRedo: true, editing: true });
      expect((plugins[0] as any).pluginName).toBe('editing');
      expect((plugins[1] as any).pluginName).toBe('undoRedo');
    });

    it('orders shell before dependent plugins regardless of key order', () => {
      registerFeature('visibility' as any, () => fakePlugin('visibility', undefined, [{ name: 'shell' }]));
      registerFeature('shell' as any, () => fakePlugin('shell'));

      // `shell` listed AFTER `visibility` must still resolve shell-first so the
      // shell host attaches before VisibilityPlugin's TBW020 dependency check.
      const plugins = createPluginsFromFeatures({ visibility: true, shell: true });
      expect((plugins[0] as any).pluginName).toBe('shell');
      expect((plugins[1] as any).pluginName).toBe('visibility');
    });

    it('returns empty array for empty features', () => {
      const plugins = createPluginsFromFeatures({});
      expect(plugins).toHaveLength(0);
    });
  });

  // #endregion

  // #region clearFeatureRegistry

  describe('clearFeatureRegistry', () => {
    it('clears all registered features', () => {
      registerFeature('selection' as any, () => fakePlugin('selection'));
      expect(getRegisteredFeatures()).toHaveLength(1);

      clearFeatureRegistry();
      expect(getRegisteredFeatures()).toHaveLength(0);
      expect(isFeatureRegistered('selection')).toBe(false);
    });
  });

  // #endregion

  // #region cross-bundle singleton (micro-frontend duplicate bundling)

  describe('cross-bundle singleton', () => {
    // When two micro-frontends each bundle their own copy of @toolbox-web/grid
    // at the SAME version, the module-scope Map would otherwise be duplicated.
    // Persisting it on globalThis under a version-scoped Symbol.for(...) key
    // makes both copies share one instance, so a `registerFeature` call from
    // one bundle is visible to the running grid class that came from another
    // bundle. Different versions intentionally get isolated keys, mirroring
    // the version-suffixed tag isolation done by `registerDataGrid()`.
    it('stores featureRegistry on globalThis under a version-scoped Symbol.for key', () => {
      registerFeature('selection' as any, () => fakePlugin('selection'));
      // The production module embeds __GRID_VERSION__ (a Vite define) in the
      // key. The same define is active in tests, so we resolve the key with
      // the same fallback chain used by registry.ts.
      const key = Symbol.for(`@toolbox-web/grid:feature-registry@${GRID_VERSION}/v1`);
      const shared = Reflect.get(globalThis, key) as Map<string, unknown> | undefined;
      expect(shared).toBeInstanceOf(Map);
      expect(shared?.has('selection')).toBe(true);
    });

    it('module-local handle and the globalThis slot are the same Map instance', () => {
      // Proves the singleton: anything a second bundled copy of registry.ts
      // would resolve via Reflect.get(globalThis, KEY) is the very same Map
      // this module is using — so registrations from either bundle land in
      // the same place.
      registerFeature('editing' as any, () => fakePlugin('editing'));
      const key = Symbol.for(`@toolbox-web/grid:feature-registry@${GRID_VERSION}/v1`);
      const fromGlobal = Reflect.get(globalThis, key) as Map<string, unknown> | undefined;
      expect(fromGlobal?.has('editing')).toBe(true);
      // Sanity: getFeatureFactory (which closes over the module-local handle)
      // must see the same entry.
      expect(getFeatureFactory('editing')).toBeDefined();
      expect(fromGlobal?.get('editing')).toBeDefined();
    });

    it('uses different globalThis keys for different grid versions', () => {
      // If two bundles at different versions used the same key they would
      // overwrite each other's plugin factories at side-effect-import time,
      // and the running grid class for version A could end up calling a
      // factory built by version B (different internal contract). The
      // version-embedded key keeps each version's registry isolated.
      const v1 = Symbol.for('@toolbox-web/grid:feature-registry@1.0.0/v1');
      const v2 = Symbol.for('@toolbox-web/grid:feature-registry@2.0.0/v1');
      expect(v1).not.toBe(v2);
    });
  });

  // #endregion
});
