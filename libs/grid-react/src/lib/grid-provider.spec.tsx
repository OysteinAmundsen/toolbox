/**
 * Tests for the combined GridProvider component.
 *
 * @vitest-environment happy-dom
 *
 * Tests cover:
 * - Combined provider with both icons and defaults
 * - Icons-only mode
 * - Defaults-only mode
 * - Neither provided (passthrough)
 * - Mounted rendering with context propagation
 */

import { createElement, useContext } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { GridIconContext } from './grid-icon-registry';
import { GridProvider, type GridProviderProps } from './grid-provider';
import { type TypeDefaultsMap } from './grid-type-registry';

// Internal context — reimport the same context used by GridTypeProvider
// to verify values propagate correctly.
import { GridTypeContextInternal } from './grid-type-registry';

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

  describe('mounted rendering', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    function renderToDiv(element: React.ReactElement): HTMLDivElement {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      flushSync(() => root.render(element));
      return container;
    }

    it('should render children when no props are provided', () => {
      const container = renderToDiv(
        createElement(GridProvider, { children: null }, createElement('span', null, 'Hello')),
      );
      expect(container.textContent).toBe('Hello');
    });

    it('should provide type defaults to descendants', () => {
      let captured: TypeDefaultsMap | null = null;

      function Consumer() {
        captured = useContext(GridTypeContextInternal);
        return null;
      }

      const defaults: TypeDefaultsMap = {
        country: { renderer: () => null },
      };

      renderToDiv(createElement(GridProvider, { defaults, children: null }, createElement(Consumer)));

      expect(captured).toBe(defaults);
      expect(captured!.country).toBeDefined();
    });

    it('should provide icon overrides to descendants', () => {
      let captured: Record<string, unknown> | null = null;

      function Consumer() {
        captured = useContext(GridIconContext);
        return null;
      }

      const icons = { expand: '➕', collapse: '➖' };

      renderToDiv(createElement(GridProvider, { icons, children: null }, createElement(Consumer)));

      expect(captured).toBe(icons);
      expect(captured!.expand).toBe('➕');
    });

    it('should provide both type defaults and icons simultaneously', () => {
      let capturedDefaults: TypeDefaultsMap | null = null;
      let capturedIcons: Record<string, unknown> | null = null;

      function Consumer() {
        capturedDefaults = useContext(GridTypeContextInternal);
        capturedIcons = useContext(GridIconContext);
        return null;
      }

      const defaults: TypeDefaultsMap = {
        status: { renderer: () => null },
      };
      const icons = { sortAsc: '↑' };

      renderToDiv(createElement(GridProvider, { defaults, icons, children: null }, createElement(Consumer)));

      expect(capturedDefaults).toBe(defaults);
      expect(capturedIcons).toBe(icons);
    });

    it('should pass null context when neither prop is provided', () => {
      let capturedDefaults: TypeDefaultsMap | null | undefined = undefined;
      let capturedIcons: Record<string, unknown> | null | undefined = undefined;

      function Consumer() {
        capturedDefaults = useContext(GridTypeContextInternal);
        capturedIcons = useContext(GridIconContext);
        return null;
      }

      renderToDiv(createElement(GridProvider, { children: null }, createElement(Consumer)));

      // No providers → null (context default)
      expect(capturedDefaults).toBeNull();
      expect(capturedIcons).toBeNull();
    });
  });
});
