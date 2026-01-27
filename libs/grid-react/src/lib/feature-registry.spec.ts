/**
 * Tests for the feature registry and sync plugin creation.
 *
 * Tests cover:
 * - Feature registration
 * - Plugin creation from features
 * - Dependency validation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearFeatureRegistry,
  createPluginFromFeature,
  getRegisteredFeatures,
  isFeatureRegistered,
  registerFeature,
  type FeatureName,
} from './feature-registry';
import { createPluginsFromFeatures, validateFeatureDependencies } from './use-sync-plugins';

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE REGISTRY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('feature-registry', () => {
  beforeEach(() => {
    // Clear registry between tests
    clearFeatureRegistry();
  });

  describe('registerFeature', () => {
    it('should register a feature factory', () => {
      const factory = vi.fn(() => ({ name: 'test' }));
      registerFeature('selection' as FeatureName, factory);

      expect(isFeatureRegistered('selection')).toBe(true);
    });

    it('should allow registering same feature twice (for HMR)', () => {
      const factory1 = vi.fn(() => ({ name: 'test1' }));
      const factory2 = vi.fn(() => ({ name: 'test2' }));

      registerFeature('selection' as FeatureName, factory1);
      registerFeature('selection' as FeatureName, factory2);

      // Second registration wins
      const plugin = createPluginFromFeature('selection', 'row');
      expect(plugin).toEqual({ name: 'test2' });
    });
  });

  describe('isFeatureRegistered', () => {
    it('should return false for unregistered feature', () => {
      expect(isFeatureRegistered('selection')).toBe(false);
    });

    it('should return true after registration', () => {
      registerFeature('selection' as FeatureName, () => ({ name: 'test' }));
      expect(isFeatureRegistered('selection')).toBe(true);
    });
  });

  describe('getRegisteredFeatures', () => {
    it('should return empty array when no features registered', () => {
      expect(getRegisteredFeatures()).toEqual([]);
    });

    it('should return all registered feature names', () => {
      registerFeature('selection' as FeatureName, () => ({ name: 'selection' }));
      registerFeature('editing' as FeatureName, () => ({ name: 'editing' }));

      const features = getRegisteredFeatures();
      expect(features).toContain('selection');
      expect(features).toContain('editing');
      expect(features).toHaveLength(2);
    });
  });

  describe('createPluginFromFeature', () => {
    it('should create plugin from registered factory', () => {
      const mockPlugin = { name: 'selection', version: '1.0' };
      registerFeature('selection' as FeatureName, () => mockPlugin);

      const plugin = createPluginFromFeature('selection', { mode: 'row' });
      expect(plugin).toBe(mockPlugin);
    });

    it('should return undefined for unregistered feature', () => {
      const plugin = createPluginFromFeature('selection', 'row');
      expect(plugin).toBeUndefined();
    });

    it('should pass config to factory', () => {
      const factory = vi.fn(() => ({ name: 'selection' }));
      registerFeature('selection' as FeatureName, factory);

      createPluginFromFeature('selection', { mode: 'range' });
      expect(factory).toHaveBeenCalledWith({ mode: 'range' });
    });

    it('should warn in dev for unregistered feature', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* noop */
      });

      createPluginFromFeature('selection', 'row');

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('selection'));
      warnSpy.mockRestore();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SYNC PLUGIN CREATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('use-sync-plugins', () => {
  beforeEach(() => {
    clearFeatureRegistry();
  });

  describe('validateFeatureDependencies', () => {
    it('should not warn when dependencies are satisfied', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* noop */
      });

      validateFeatureDependencies(['selection', 'clipboard'] as FeatureName[]);

      // clipboard depends on selection, which is present
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should warn when clipboard is used without selection', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* noop */
      });

      validateFeatureDependencies(['clipboard'] as FeatureName[]);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('selection'));
      warnSpy.mockRestore();
    });

    it('should warn when undoRedo is used without editing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* noop */
      });

      validateFeatureDependencies(['undoRedo'] as FeatureName[]);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('editing'));
      warnSpy.mockRestore();
    });
  });

  describe('createPluginsFromFeatures', () => {
    it('should return empty array when no features enabled', () => {
      const plugins = createPluginsFromFeatures({});
      expect(plugins).toEqual([]);
    });

    it('should skip features with undefined values', () => {
      const plugins = createPluginsFromFeatures({ selection: undefined });
      expect(plugins).toEqual([]);
    });

    it('should skip features with false values', () => {
      const plugins = createPluginsFromFeatures({ selection: false as any });
      expect(plugins).toEqual([]);
    });

    it('should create plugins for registered features', () => {
      const mockPlugin = { name: 'selection' };
      registerFeature('selection' as FeatureName, () => mockPlugin);

      const plugins = createPluginsFromFeatures({ selection: 'row' });
      expect(plugins).toContain(mockPlugin);
    });

    it('should skip unregistered features', () => {
      // Don't register selection
      const plugins = createPluginsFromFeatures({ selection: 'row' });
      expect(plugins).toEqual([]);
    });

    it('should create plugins in dependency order', () => {
      const order: string[] = [];
      registerFeature('selection' as FeatureName, () => {
        order.push('selection');
        return { name: 'selection' };
      });
      registerFeature('editing' as FeatureName, () => {
        order.push('editing');
        return { name: 'editing' };
      });
      registerFeature('clipboard' as FeatureName, () => {
        order.push('clipboard');
        return { name: 'clipboard' };
      });

      // Enable in reverse order
      createPluginsFromFeatures({ clipboard: true, selection: 'row' });

      // Selection should be created before clipboard
      expect(order.indexOf('selection')).toBeLessThan(order.indexOf('clipboard'));
    });
  });
});
