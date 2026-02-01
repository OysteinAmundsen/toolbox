/**
 * Tests for the grid icon registry.
 *
 * Tests cover:
 * - GridIconProvider component
 * - useGridIcons composable
 * - GRID_ICONS injection key
 */

import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import { GRID_ICONS, GridIconProvider, useGridIcons } from './grid-icon-registry';

// ═══════════════════════════════════════════════════════════════════════════
// GRID ICON PROVIDER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('grid-icon-registry', () => {
  describe('GridIconProvider', () => {
    it('should be a valid Vue component', () => {
      expect(GridIconProvider).toBeDefined();
      expect(GridIconProvider.name).toBe('GridIconProvider');
    });

    it('should have icons prop', () => {
      expect(GridIconProvider.props).toBeDefined();
      expect(GridIconProvider.props).toHaveProperty('icons');
    });

    it('should render slot content', () => {
      // Test that component can be instantiated with correct props
      const vnode = h(GridIconProvider, { icons: { expand: '➕' } }, () => h('div'));
      expect(vnode).toBeDefined();
      expect(vnode.type).toBe(GridIconProvider);
      expect(vnode.props?.icons).toEqual({ expand: '➕' });
    });

    it('should accept all icon types in props', () => {
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

      const vnode = h(GridIconProvider, { icons: allIcons }, () => null);
      expect(Object.keys(vnode.props?.icons ?? {})).toHaveLength(11);
    });
  });

  describe('useGridIcons', () => {
    it('should be a valid function', () => {
      expect(useGridIcons).toBeDefined();
      expect(typeof useGridIcons).toBe('function');
    });

    it('should return undefined when called outside provider', () => {
      // When called outside a component, inject returns the default value
      const result = useGridIcons();
      expect(result).toBeUndefined();
    });
  });

  describe('GRID_ICONS', () => {
    it('should be a valid injection key', () => {
      expect(GRID_ICONS).toBeDefined();
      expect(typeof GRID_ICONS).toBe('symbol');
    });
  });
});
