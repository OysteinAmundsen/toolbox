/**
 * Tests for the grid icon registry exports.
 *
 * Tests cover:
 * - Export of GridIconRegistry, GRID_ICONS, provideGridIcons
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
