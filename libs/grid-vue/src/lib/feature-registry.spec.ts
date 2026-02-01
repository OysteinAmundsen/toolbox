/**
 * Tests for the feature registry and plugin creation.
 *
 * Tests cover:
 * - Feature registration
 * - Plugin creation from features
 * - Warning for unregistered features
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearFeatureRegistry,
  createPluginFromFeature,
  getFeatureFactory,
  getRegisteredFeatures,
  isFeatureRegistered,
  registerFeature,
  type FeatureName,
} from './feature-registry';

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
      const plugin = createPluginFromFeature('selection', { mode: 'row' });
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

  describe('getFeatureFactory', () => {
    it('should return factory for registered feature', () => {
      const factory = vi.fn(() => ({ name: 'test' }));
      registerFeature('selection' as FeatureName, factory);

      const retrieved = getFeatureFactory('selection');
      expect(retrieved).toBe(factory);
    });

    it('should return undefined for unregistered feature', () => {
      expect(getFeatureFactory('selection')).toBeUndefined();
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
      const plugin = createPluginFromFeature('selection', { mode: 'row' });
      expect(plugin).toBeUndefined();
    });

    it('should pass config to factory', () => {
      const factory = vi.fn(() => ({ name: 'selection' }));
      registerFeature('selection' as FeatureName, factory);

      createPluginFromFeature('selection', { mode: 'range' });
      expect(factory).toHaveBeenCalledWith({ mode: 'range' });
    });

    it('should warn once for unregistered feature', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // First call should warn
      createPluginFromFeature('clipboard', {});
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('clipboard'));

      // Second call should not warn again
      createPluginFromFeature('clipboard', {});
      expect(warnSpy).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });
  });
});
