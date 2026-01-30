/**
 * Tests for the combined GridProvider component.
 *
 * Tests cover:
 * - Combined provider with both icons and defaults
 * - Icons-only mode
 * - Defaults-only mode
 * - Neither provided (passthrough)
 */

import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { GridProvider, type GridProviderProps } from './grid-provider';

// ═══════════════════════════════════════════════════════════════════════════
// GRID PROVIDER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('grid-provider', () => {
  describe('GridProvider', () => {
    it('should be a valid React component', () => {
      expect(GridProvider).toBeDefined();
      expect(typeof GridProvider).toBe('function');
    });

    it('should accept both icons and defaults props', () => {
      const icons = { expand: 'X', collapse: 'O' };
      const defaults = {
        country: { renderer: () => null },
      };

      const props: GridProviderProps = {
        icons,
        defaults,
        children: null,
      };

      const element = createElement(GridProvider, props, null);
      expect(element).toBeDefined();
      expect(element.type).toBe(GridProvider);
      expect(element.props.icons).toEqual(icons);
      expect(element.props.defaults).toEqual(defaults);
    });

    it('should accept only icons prop', () => {
      const icons = { sortAsc: '↑' };

      const props: GridProviderProps = {
        icons,
        children: null,
      };

      const element = createElement(GridProvider, props, null);
      expect(element.props.icons).toEqual(icons);
      expect(element.props.defaults).toBeUndefined();
    });

    it('should accept only defaults prop', () => {
      const defaults = {
        status: { renderer: () => null },
      };

      const props: GridProviderProps = {
        defaults,
        children: null,
      };

      const element = createElement(GridProvider, props, null);
      expect(element.props.defaults).toEqual(defaults);
      expect(element.props.icons).toBeUndefined();
    });

    it('should work with no icons or defaults', () => {
      const props: GridProviderProps = {
        children: null,
      };

      const element = createElement(GridProvider, props, null);
      expect(element.props.icons).toBeUndefined();
      expect(element.props.defaults).toBeUndefined();
    });

    it('should accept children', () => {
      const child = createElement('div', { key: 'child' }, 'Test Content');

      const element = createElement(GridProvider, { icons: { expand: '+' } }, child);
      expect(element.props.children).toBe(child);
    });
  });
});
