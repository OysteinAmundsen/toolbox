/**
 * Tests for ReactGridAdapter registration and lookup
 */
import type { CellRenderContext, ColumnEditorContext } from '@toolbox-web/grid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import the registration functions directly
import {
  getColumnEditor,
  getColumnRenderer,
  getRegisteredFields,
  ReactGridAdapter,
  registerColumnEditor,
  registerColumnRenderer,
} from './react-grid-adapter';

describe('ReactGridAdapter', () => {
  describe('field-based registry', () => {
    beforeEach(() => {
      // Note: In a real test, we'd need to clear the registries
      // For now, we just verify the registration works
    });

    it('should register renderer and lookup by element', () => {
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'testField');

      const renderer = () => 'test';
      registerColumnRenderer(element, renderer);

      const retrieved = getColumnRenderer(element);
      expect(retrieved).toBe(renderer);
    });

    it('should register renderer and lookup by field for different element', () => {
      const element1 = document.createElement('tbw-grid-column');
      element1.setAttribute('field', 'statusField');

      const renderer = () => 'status badge';
      registerColumnRenderer(element1, renderer);

      // Create a new element with same field (simulates React re-render)
      const element2 = document.createElement('tbw-grid-column');
      element2.setAttribute('field', 'statusField');

      // Should find via field lookup even though element is different
      const retrieved = getColumnRenderer(element2);
      expect(retrieved).toBe(renderer);
    });

    it('should track registered fields', () => {
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'myField');

      registerColumnRenderer(element, () => 'test');

      const fields = getRegisteredFields();
      expect(fields).toContain('myField');
    });

    it('should register editor and lookup by element', () => {
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'editorTestField');

      const editor = () => 'editor';
      registerColumnEditor(element, editor);

      const retrieved = getColumnEditor(element);
      expect(retrieved).toBe(editor);
    });

    it('should register editor and lookup by field for different element', () => {
      const element1 = document.createElement('tbw-grid-column');
      element1.setAttribute('field', 'editorFieldLookup');

      const editor = () => 'my editor';
      registerColumnEditor(element1, editor);

      // Create a new element with same field (simulates React re-render)
      const element2 = document.createElement('tbw-grid-column');
      element2.setAttribute('field', 'editorFieldLookup');

      // Should find via field lookup even though element is different
      const retrieved = getColumnEditor(element2);
      expect(retrieved).toBe(editor);
    });

    it('should return undefined for unregistered element', () => {
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'unregisteredField');

      expect(getColumnRenderer(element)).toBeUndefined();
      expect(getColumnEditor(element)).toBeUndefined();
    });
  });

  describe('ReactGridAdapter class', () => {
    let adapter: ReactGridAdapter;

    beforeEach(() => {
      adapter = new ReactGridAdapter();
    });

    describe('canHandle', () => {
      it('should return true for registered elements with renderer', () => {
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'adapterTestField');

        registerColumnRenderer(element, () => 'test');

        expect(adapter.canHandle(element)).toBe(true);
      });

      it('should return true for registered elements with editor', () => {
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'adapterEditorField');

        registerColumnEditor(element, () => 'editor');

        expect(adapter.canHandle(element)).toBe(true);
      });

      it('should find via field lookup', () => {
        // Register on one element
        const element1 = document.createElement('tbw-grid-column');
        element1.setAttribute('field', 'fieldLookupTest');
        registerColumnRenderer(element1, () => 'test');

        // Check with different element same field
        const element2 = document.createElement('tbw-grid-column');
        element2.setAttribute('field', 'fieldLookupTest');

        expect(adapter.canHandle(element2)).toBe(true);
      });

      it('should return false for unregistered elements', () => {
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'unknownFieldCanHandle');

        expect(adapter.canHandle(element)).toBe(false);
      });

      it('should return false for elements without field attribute', () => {
        const element = document.createElement('tbw-grid-column');
        // No field attribute

        expect(adapter.canHandle(element)).toBe(false);
      });
    });

    describe('createRenderer', () => {
      it('should return a function that creates React content', () => {
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'createRendererTest');

        registerColumnRenderer(element, (ctx) => `Value: ${ctx.value}`);

        const renderer = adapter.createRenderer(element);
        expect(typeof renderer).toBe('function');

        // Call the renderer
        const result = renderer({
          row: {},
          value: 'hello',
          field: 'createRendererTest',
          column: {} as any,
        } as CellRenderContext<unknown, string>);

        // Result should be an HTMLElement (container with React content)
        expect(result).toBeTruthy();
        expect(result instanceof HTMLElement).toBe(true);
      });

      it('should return undefined for unregistered element (allows grid default rendering)', () => {
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'unregisteredRenderer');

        const renderer = adapter.createRenderer(element);

        // Renderer should be undefined/falsy so grid uses default rendering
        // This is important for GridColumn with only an editor (no children)
        expect(renderer).toBeFalsy();
      });

      it('should reuse cached root when cellEl is provided', () => {
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'cachedRenderTest');

        let renderCount = 0;
        registerColumnRenderer(element, (ctx) => {
          renderCount++;
          return `Rendered: ${ctx.value}`;
        });

        const renderer = adapter.createRenderer(element);

        // Create a mock cell element
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';

        // First render - creates new root
        const result1 = renderer({
          row: {},
          value: 'first',
          field: 'cachedRenderTest',
          column: {} as any,
          cellEl,
          rowIndex: 0,
        } as any);

        expect(result1 instanceof HTMLElement).toBe(true);
        expect(renderCount).toBe(1);

        // Second render with same cellEl - should reuse root
        const result2 = renderer({
          row: {},
          value: 'second',
          field: 'cachedRenderTest',
          column: {} as any,
          cellEl,
          rowIndex: 0,
        } as any);

        // Should return same container
        expect(result2).toBe(result1);
        expect(renderCount).toBe(2);
      });

      it('should create new container when no cellEl in context', () => {
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'noCellElTest');

        registerColumnRenderer(element, () => 'fallback content');

        const renderer = adapter.createRenderer(element);

        // First render without cellEl
        const result1 = renderer({ row: {}, value: 'a', field: 'noCellElTest', column: {} as any });

        // Second render without cellEl
        const result2 = renderer({ row: {}, value: 'b', field: 'noCellElTest', column: {} as any });

        // Should be different containers (no caching without cellEl)
        expect(result1).not.toBe(result2);
      });
    });

    describe('createEditor', () => {
      it('should create an editor container with React content', () => {
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'createEditorTest');

        const commitFn = vi.fn();
        const cancelFn = vi.fn();

        registerColumnEditor(element, (ctx) => `Editing: ${ctx.value}`);

        const editorSpec = adapter.createEditor(element);
        expect(typeof editorSpec).toBe('function');

        const result = editorSpec({
          row: { name: 'test' },
          value: 'initial',
          field: 'createEditorTest',
          column: {} as any,
          commit: commitFn,
          cancel: cancelFn,
        } as ColumnEditorContext<unknown, string>);

        expect(result instanceof HTMLElement).toBe(true);
        expect(result.className).toBe('react-cell-editor');
      });

      it('should return empty div for unregistered editor', () => {
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'unregisteredEditor');

        const editorSpec = adapter.createEditor(element);
        const result = editorSpec({
          row: {},
          value: 'test',
          field: 'unregisteredEditor',
          column: {} as any,
          commit: vi.fn(),
          cancel: vi.fn(),
        });

        expect(result instanceof HTMLElement).toBe(true);
        expect(result.tagName).toBe('DIV');
      });
    });

    describe('createToolPanelRenderer', () => {
      it('should return undefined (tool panels handled via component pattern)', () => {
        const element = document.createElement('tbw-grid-tool-panel');

        const result = adapter.createToolPanelRenderer(element);

        expect(result).toBeUndefined();
      });
    });

    describe('destroy', () => {
      it('should unmount all mounted React roots', () => {
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'destroyTest');

        registerColumnRenderer(element, () => 'content');

        const renderer = adapter.createRenderer(element);

        // Create some mounted views
        renderer({ row: {}, value: 'a', field: 'destroyTest', column: {} as any });
        renderer({ row: {}, value: 'b', field: 'destroyTest', column: {} as any });

        // Should not throw
        expect(() => adapter.destroy()).not.toThrow();
      });

      it('should handle destroy when no views are mounted', () => {
        expect(() => adapter.destroy()).not.toThrow();
      });
    });

    describe('unmount', () => {
      it('should unmount a specific container', () => {
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'unmountTest');

        registerColumnRenderer(element, () => 'unmount content');

        const renderer = adapter.createRenderer(element);

        // Create a mounted view
        const container = renderer({
          row: {},
          value: 'test',
          field: 'unmountTest',
          column: {} as any,
        }) as HTMLElement;

        // Should not throw
        expect(() => adapter.unmount(container)).not.toThrow();
      });

      it('should handle unmount for non-tracked container', () => {
        const unknownContainer = document.createElement('div');

        // Should not throw even for unknown container
        expect(() => adapter.unmount(unknownContainer)).not.toThrow();
      });
    });
  });
});
