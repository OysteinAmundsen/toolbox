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

/** Minimal plugin stub for testing. */
function fakePlugin(name: string, config?: unknown): GridPlugin {
  return { pluginName: name, _config: config } as unknown as GridPlugin;
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
      registerFeature('clipboard' as any, () => fakePlugin('clipboard'));
      registerFeature('selection' as any, () => fakePlugin('selection'));

      const plugins = createPluginsFromFeatures({ clipboard: true, selection: true });
      expect((plugins[0] as any).pluginName).toBe('selection');
      expect((plugins[1] as any).pluginName).toBe('clipboard');
    });

    it('orders editing before dependent plugins', () => {
      registerFeature('undoRedo' as any, () => fakePlugin('undoRedo'));
      registerFeature('editing' as any, () => fakePlugin('editing'));

      const plugins = createPluginsFromFeatures({ undoRedo: true, editing: true });
      expect((plugins[0] as any).pluginName).toBe('editing');
      expect((plugins[1] as any).pluginName).toBe('undoRedo');
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
});
