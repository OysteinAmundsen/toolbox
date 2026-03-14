/**
 * Tests for the grid provider (combined type + icon provider).
 *
 * Tests cover:
 * - GridProvider component
 * - Combined provider functionality
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h } from 'vue';
import { GridProvider } from './grid-provider';
import type { TypeDefaultsMap } from './grid-type-registry';

// ═══════════════════════════════════════════════════════════════════════════
// GRID PROVIDER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('grid-provider', () => {
  describe('GridProvider', () => {
    it('should be a valid Vue component', () => {
      expect(GridProvider).toBeDefined();
      expect(GridProvider.name).toBe('GridProvider');
    });

    it('should have typeDefaults prop', () => {
      expect(GridProvider.props).toBeDefined();
      expect(GridProvider.props).toHaveProperty('typeDefaults');
    });

    it('should have icons prop', () => {
      expect(GridProvider.props).toHaveProperty('icons');
    });

    it('should accept typeDefaults only', () => {
      const defaults: TypeDefaultsMap = {
        currency: { renderer: () => h('span', '$100') },
      };

      const vnode = h(GridProvider, { typeDefaults: defaults }, () => h('div'));
      expect(vnode).toBeDefined();
      expect(vnode.props?.typeDefaults).toBe(defaults);
    });

    it('should accept icons only', () => {
      const icons = { expand: '➕', collapse: '➖' };

      const vnode = h(GridProvider, { icons }, () => h('div'));
      expect(vnode).toBeDefined();
      expect(vnode.props?.icons).toEqual(icons);
    });

    it('should accept both typeDefaults and icons', () => {
      const defaults: TypeDefaultsMap = {
        currency: { renderer: () => h('span', '$100') },
      };
      const icons = { expand: '➕', collapse: '➖' };

      const vnode = h(GridProvider, { typeDefaults: defaults, icons }, () => h('div'));
      expect(vnode).toBeDefined();
      expect(vnode.props?.typeDefaults).toBe(defaults);
      expect(vnode.props?.icons).toEqual(icons);
    });

    it('should render slot content', () => {
      const vnode = h(GridProvider, {}, () => h('div', { id: 'child' }));
      expect(vnode).toBeDefined();
      expect(vnode.type).toBe(GridProvider);
    });

    // #region Mounted rendering tests

    describe('mounted rendering', () => {
      afterEach(() => {
        document.body.innerHTML = '';
      });

      it('should render slot content when mounted with no props', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const app = createApp(
          defineComponent({
            setup() {
              return () => h(GridProvider, {}, () => h('span', { id: 'child' }, 'Hello'));
            },
          }),
        );
        app.mount(container);

        expect(container.querySelector('#child')).not.toBeNull();
        expect(container.querySelector('#child')?.textContent).toBe('Hello');

        app.unmount();
      });

      it('should render with only typeDefaults prop', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const defaults: TypeDefaultsMap = {
          currency: { renderer: () => h('span', '$100') },
        };

        const app = createApp(
          defineComponent({
            setup() {
              return () => h(GridProvider, { typeDefaults: defaults }, () => h('span', { id: 'td-child' }, 'Content'));
            },
          }),
        );
        app.mount(container);

        expect(container.querySelector('#td-child')).not.toBeNull();

        app.unmount();
      });

      it('should render with only icons prop', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const icons = { expand: '➕', collapse: '➖' };

        const app = createApp(
          defineComponent({
            setup() {
              return () => h(GridProvider, { icons }, () => h('span', { id: 'icon-child' }, 'Content'));
            },
          }),
        );
        app.mount(container);

        expect(container.querySelector('#icon-child')).not.toBeNull();

        app.unmount();
      });

      it('should render with both typeDefaults and icons props', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const defaults: TypeDefaultsMap = {
          currency: { renderer: () => h('span', '$100') },
        };
        const icons = { expand: '➕' };

        const app = createApp(
          defineComponent({
            setup() {
              return () =>
                h(GridProvider, { typeDefaults: defaults, icons }, () => h('span', { id: 'both-child' }, 'Content'));
            },
          }),
        );
        app.mount(container);

        expect(container.querySelector('#both-child')).not.toBeNull();

        app.unmount();
      });
    });

    // #endregion
  });
});
