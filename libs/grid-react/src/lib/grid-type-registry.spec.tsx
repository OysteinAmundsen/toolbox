/**
 * Tests for the GridTypeRegistry (typeDefaultToBaseTypeDefault, wrapReactFilterPanelRenderer).
 *
 * @vitest-environment happy-dom
 */
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  GridTypeProvider,
  type TypeDefault,
  type TypeDefaultsMap,
  typeDefaultToBaseTypeDefault,
  wrapReactFilterPanelRenderer,
} from './grid-type-registry';

describe('grid-type-registry', () => {
  describe('GridTypeProvider', () => {
    it('should be a valid React component', () => {
      expect(GridTypeProvider).toBeDefined();
      expect(typeof GridTypeProvider).toBe('function');
    });

    it('should accept defaults and children props', () => {
      const defaults: TypeDefaultsMap = {
        country: { renderer: () => null },
      };
      const element = createElement(GridTypeProvider, { defaults }, null);
      expect(element).toBeDefined();
      expect(element.type).toBe(GridTypeProvider);
      expect(element.props.defaults).toBe(defaults);
    });
  });

  describe('typeDefaultToBaseTypeDefault', () => {
    it('should return base type default with editorParams', () => {
      const mockRender = vi.fn((node) => document.createElement('div'));
      const typeDefault: TypeDefault = {
        editorParams: { options: ['A', 'B'] },
      };

      const result = typeDefaultToBaseTypeDefault(typeDefault, mockRender);
      expect(result.editorParams).toEqual({ options: ['A', 'B'] });
    });

    it('should wrap renderer into DOM-returning function', () => {
      const container = document.createElement('div');
      const mockRender = vi.fn(() => container);
      const typeDefault: TypeDefault = {
        renderer: (ctx) => createElement('span', null, String(ctx.value)),
      };

      const result = typeDefaultToBaseTypeDefault(typeDefault, mockRender);
      expect(result.renderer).toBeDefined();

      // Call the wrapped renderer
      const context = { value: 'test', row: {}, column: {} as any, cellEl: document.createElement('td') };
      const element = result.renderer!(context as any);
      expect(element).toBe(container);
      expect(mockRender).toHaveBeenCalled();
    });

    it('should wrap editor into DOM-returning function', () => {
      const container = document.createElement('div');
      const mockRender = vi.fn(() => container);
      const typeDefault: TypeDefault = {
        editor: (ctx) => createElement('input', { value: ctx.value }),
      };

      const result = typeDefaultToBaseTypeDefault(typeDefault, mockRender);
      expect(result.editor).toBeDefined();
    });

    it('should not set renderer when not provided', () => {
      const mockRender = vi.fn();
      const typeDefault: TypeDefault = {
        editorParams: { min: 0 },
      };

      const result = typeDefaultToBaseTypeDefault(typeDefault, mockRender);
      expect(result.renderer).toBeUndefined();
      expect(result.editor).toBeUndefined();
    });

    it('should wrap filterPanelRenderer when provided', () => {
      const container = document.createElement('div');
      const mockRender = vi.fn(() => container);
      const typeDefault: TypeDefault = {
        filterPanelRenderer: (params) => createElement('div', null, 'Filter Panel'),
      };

      const result = typeDefaultToBaseTypeDefault(typeDefault, mockRender);
      expect(result.filterPanelRenderer).toBeDefined();
    });

    it('should not set filterPanelRenderer when not provided', () => {
      const mockRender = vi.fn();
      const typeDefault: TypeDefault = { renderer: () => null };

      const result = typeDefaultToBaseTypeDefault(typeDefault, mockRender);
      expect(result.filterPanelRenderer).toBeUndefined();
    });
  });

  describe('wrapReactFilterPanelRenderer', () => {
    it('should create a function that appends rendered content to container', () => {
      const rendered = document.createElement('span');
      rendered.textContent = 'filter content';
      const mockRender = vi.fn(() => rendered);
      const reactFn = vi.fn(() => createElement('span', null, 'filter'));

      const wrapped = wrapReactFilterPanelRenderer(reactFn, mockRender);
      expect(typeof wrapped).toBe('function');

      const container = document.createElement('div');
      const params = { field: 'name' } as any;
      wrapped(container, params);

      expect(reactFn).toHaveBeenCalledWith(params);
      expect(mockRender).toHaveBeenCalled();
      expect(container.children).toHaveLength(1);
      expect(container.children[0]).toBe(rendered);
    });
  });

  describe('TypeDefault interface', () => {
    it('should accept renderer-only type default', () => {
      const td: TypeDefault = {
        renderer: (ctx) => createElement('span', null, ctx.value as string),
      };
      expect(td.renderer).toBeDefined();
      expect(td.editor).toBeUndefined();
    });

    it('should accept editor-only type default', () => {
      const td: TypeDefault = {
        editor: (ctx) => createElement('input', { value: ctx.value }),
      };
      expect(td.editor).toBeDefined();
    });

    it('should accept full type default', () => {
      const td: TypeDefault = {
        renderer: () => null,
        editor: () => null,
        editorParams: { max: 100 },
        filterPanelRenderer: () => null,
      };
      expect(td.renderer).toBeDefined();
      expect(td.editor).toBeDefined();
      expect(td.editorParams).toEqual({ max: 100 });
      expect(td.filterPanelRenderer).toBeDefined();
    });
  });
});
