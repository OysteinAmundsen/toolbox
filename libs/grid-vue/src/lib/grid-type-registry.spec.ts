/**
 * Tests for the grid type registry.
 *
 * Tests cover:
 * - GridTypeProvider component
 * - useGridTypeDefaults composable
 * - useTypeDefault composable
 * - GRID_TYPE_DEFAULTS injection key
 */

import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import {
  GRID_TYPE_DEFAULTS,
  GridTypeProvider,
  useGridTypeDefaults,
  useTypeDefault,
  type TypeDefaultsMap,
} from './grid-type-registry';

// ═══════════════════════════════════════════════════════════════════════════
// GRID TYPE PROVIDER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('grid-type-registry', () => {
  describe('GridTypeProvider', () => {
    it('should be a valid Vue component', () => {
      expect(GridTypeProvider).toBeDefined();
      expect(GridTypeProvider.name).toBe('GridTypeProvider');
    });

    it('should have defaults prop', () => {
      expect(GridTypeProvider.props).toBeDefined();
      expect(GridTypeProvider.props).toHaveProperty('defaults');
    });

    it('should render slot content', () => {
      const defaults: TypeDefaultsMap = {
        currency: {
          renderer: () => h('span', 'formatted'),
        },
      };

      const vnode = h(GridTypeProvider, { defaults }, () => h('div'));
      expect(vnode).toBeDefined();
      expect(vnode.type).toBe(GridTypeProvider);
      expect(vnode.props?.defaults).toBe(defaults);
    });

    it('should accept multiple type defaults', () => {
      const defaults: TypeDefaultsMap = {
        currency: { renderer: () => h('span', '$100') },
        percentage: { renderer: () => h('span', '50%') },
        date: { renderer: () => h('span', '2024-01-01') },
      };

      const vnode = h(GridTypeProvider, { defaults }, () => null);
      expect(Object.keys(vnode.props?.defaults ?? {})).toHaveLength(3);
    });
  });

  describe('useGridTypeDefaults', () => {
    it('should be a valid function', () => {
      expect(useGridTypeDefaults).toBeDefined();
      expect(typeof useGridTypeDefaults).toBe('function');
    });

    it('should return undefined when called outside provider', () => {
      const result = useGridTypeDefaults();
      expect(result).toBeUndefined();
    });
  });

  describe('useTypeDefault', () => {
    it('should be a valid function', () => {
      expect(useTypeDefault).toBeDefined();
      expect(typeof useTypeDefault).toBe('function');
    });

    it('should return undefined for any type when called outside provider', () => {
      const result = useTypeDefault('currency');
      expect(result).toBeUndefined();
    });
  });

  describe('GRID_TYPE_DEFAULTS', () => {
    it('should be a valid injection key', () => {
      expect(GRID_TYPE_DEFAULTS).toBeDefined();
      expect(typeof GRID_TYPE_DEFAULTS).toBe('symbol');
    });
  });
});
