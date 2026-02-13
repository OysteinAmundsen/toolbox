/**
 * Tests for the grid icon registry exports and logic.
 *
 * Tests cover:
 * - Export of GridIconRegistry, GRID_ICONS, provideGridIcons
 * - GridIconRegistry methods (set, get, remove, has, getAll, getRegisteredIcons)
 *
 * Note: GridIconRegistry constructor uses inject() which requires Angular DI.
 * We test individual methods by calling them on a manually constructed instance.
 */

import { describe, expect, it } from 'vitest';
import { GRID_ICONS, GridIconRegistry, provideGridIcons } from './grid-icon-registry';

// ═══════════════════════════════════════════════════════════════════════════
// GRID ICON REGISTRY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('grid-icon-registry exports', () => {
  describe('GridIconRegistry', () => {
    it('should be exported as a class', () => {
      expect(GridIconRegistry).toBeDefined();
      expect(typeof GridIconRegistry).toBe('function');
    });

    it('should have set method', () => {
      expect(typeof GridIconRegistry.prototype.set).toBe('function');
    });

    it('should have get method', () => {
      expect(typeof GridIconRegistry.prototype.get).toBe('function');
    });

    it('should have remove method', () => {
      expect(typeof GridIconRegistry.prototype.remove).toBe('function');
    });

    it('should have has method', () => {
      expect(typeof GridIconRegistry.prototype.has).toBe('function');
    });

    it('should have getAll method', () => {
      expect(typeof GridIconRegistry.prototype.getAll).toBe('function');
    });

    it('should have getRegisteredIcons method', () => {
      expect(typeof GridIconRegistry.prototype.getRegisteredIcons).toBe('function');
    });
  });

  describe('GridIconRegistry methods', () => {
    // Create a registry instance without DI by constructing and manually setting the Map
    function createRegistry(): GridIconRegistry {
      // We create an object that has the same prototype methods
      // but bypass the constructor which uses inject()
      const registry = Object.create(GridIconRegistry.prototype);
      // Initialize the private 'icons' Map (same as constructor would)
      Object.defineProperty(registry, 'icons', {
        value: new Map(),
        writable: true,
      });
      return registry;
    }

    it('should set and get an icon', () => {
      const registry = createRegistry();
      registry.set('expand', '➕');
      expect(registry.get('expand')).toBe('➕');
    });

    it('should return undefined for unset icon', () => {
      const registry = createRegistry();
      expect(registry.get('expand')).toBeUndefined();
    });

    it('should check if icon exists via has', () => {
      const registry = createRegistry();
      expect(registry.has('expand')).toBe(false);
      registry.set('expand', '+');
      expect(registry.has('expand')).toBe(true);
    });

    it('should remove an icon', () => {
      const registry = createRegistry();
      registry.set('expand', '+');
      expect(registry.has('expand')).toBe(true);

      registry.remove('expand');
      expect(registry.has('expand')).toBe(false);
      expect(registry.get('expand')).toBeUndefined();
    });

    it('should return all icons via getAll', () => {
      const registry = createRegistry();
      registry.set('expand', '+');
      registry.set('collapse', '-');

      const all = registry.getAll();
      expect(all).toEqual({ expand: '+', collapse: '-' });
    });

    it('should return empty object from getAll when no icons', () => {
      const registry = createRegistry();
      expect(registry.getAll()).toEqual({});
    });

    it('should return registered icon names', () => {
      const registry = createRegistry();
      registry.set('expand', '+');
      registry.set('sortAsc', '↑');

      const names = registry.getRegisteredIcons();
      expect(names).toContain('expand');
      expect(names).toContain('sortAsc');
      expect(names).toHaveLength(2);
    });

    it('should return empty array when no icons registered', () => {
      const registry = createRegistry();
      expect(registry.getRegisteredIcons()).toEqual([]);
    });

    it('should overwrite existing icon on set', () => {
      const registry = createRegistry();
      registry.set('expand', '+');
      registry.set('expand', '➕');
      expect(registry.get('expand')).toBe('➕');
    });
  });

  describe('GRID_ICONS', () => {
    it('should be exported as an InjectionToken', () => {
      expect(GRID_ICONS).toBeDefined();
      expect(GRID_ICONS.toString()).toContain('GRID_ICONS');
    });
  });

  describe('provideGridIcons', () => {
    it('should be exported as a function', () => {
      expect(provideGridIcons).toBeDefined();
      expect(typeof provideGridIcons).toBe('function');
    });

    it('should return EnvironmentProviders', () => {
      const result = provideGridIcons({ expand: '+' });
      expect(result).toBeDefined();
      // EnvironmentProviders is a branded type, check for ɵproviders
      expect((result as any).ɵproviders).toBeDefined();
    });

    it('should accept partial GridIcons', () => {
      // Should compile and not throw
      const result = provideGridIcons({
        expand: '➕',
        collapse: '➖',
        sortAsc: '↑',
        sortDesc: '↓',
      });
      expect(result).toBeDefined();
    });

    it('should accept empty icons object', () => {
      const result = provideGridIcons({});
      expect(result).toBeDefined();
    });

    it('should accept all icon types', () => {
      const allIcons = {
        expand: 'exp',
        collapse: 'col',
        sortAsc: 'asc',
        sortDesc: 'desc',
        sortNone: 'none',
        submenuArrow: 'arrow',
        dragHandle: 'drag',
        toolPanel: 'panel',
        filter: 'flt',
        filterActive: 'fltA',
        print: 'prt',
      };
      const result = provideGridIcons(allIcons);
      expect(result).toBeDefined();
    });
  });
});
