/**
 * Tests for VueGridAdapter registration and lookup
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { VNode } from 'vue';

import {
  clearFieldRegistries,
  getColumnEditor,
  getColumnRenderer,
  getRegisteredFields,
  registerColumnEditor,
  registerColumnRenderer,
  VueGridAdapter,
} from './vue-grid-adapter';

describe('VueGridAdapter', () => {
  describe('field-based registry', () => {
    beforeEach(() => {
      clearFieldRegistries();
    });

    it('should register renderer and lookup by element', () => {
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'testField');

      const renderer = () => null as unknown as VNode;
      registerColumnRenderer(element, renderer);

      const retrieved = getColumnRenderer(element);
      expect(retrieved).toBe(renderer);
    });

    it('should register renderer and lookup by field for different element', () => {
      const element1 = document.createElement('tbw-grid-column');
      element1.setAttribute('field', 'statusField');

      const renderer = () => null as unknown as VNode;
      registerColumnRenderer(element1, renderer);

      // Create a new element with same field (simulates Vue re-render)
      const element2 = document.createElement('tbw-grid-column');
      element2.setAttribute('field', 'statusField');

      // Should find via field lookup even though element is different
      const retrieved = getColumnRenderer(element2);
      expect(retrieved).toBe(renderer);
    });

    it('should track registered fields', () => {
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'myField');

      registerColumnRenderer(element, () => null as unknown as VNode);

      const fields = getRegisteredFields();
      expect(fields).toContain('myField');
    });

    it('should register editor and lookup by element', () => {
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'editorTestField');

      const editor = () => null as unknown as VNode;
      registerColumnEditor(element, editor);

      const retrieved = getColumnEditor(element);
      expect(retrieved).toBe(editor);
    });

    it('should register editor and lookup by field for different element', () => {
      const element1 = document.createElement('tbw-grid-column');
      element1.setAttribute('field', 'editorFieldLookup');

      const editor = () => null as unknown as VNode;
      registerColumnEditor(element1, editor);

      // Create a new element with same field (simulates Vue re-render)
      const element2 = document.createElement('tbw-grid-column');
      element2.setAttribute('field', 'editorFieldLookup');

      const retrieved = getColumnEditor(element2);
      expect(retrieved).toBe(editor);
    });

    it('should return undefined for unregistered element', () => {
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'unknownField');

      expect(getColumnRenderer(element)).toBeUndefined();
      expect(getColumnEditor(element)).toBeUndefined();
    });
  });

  describe('VueGridAdapter class', () => {
    it('should be a valid class', () => {
      expect(VueGridAdapter).toBeDefined();
      expect(typeof VueGridAdapter).toBe('function');
    });

    it('should have required interface methods', () => {
      expect(VueGridAdapter.prototype.canHandle).toBeDefined();
      expect(VueGridAdapter.prototype.createRenderer).toBeDefined();
      expect(VueGridAdapter.prototype.createEditor).toBeDefined();
      expect(VueGridAdapter.prototype.cleanup).toBeDefined();
    });

    it('should instantiate correctly', () => {
      const adapter = new VueGridAdapter();
      expect(adapter).toBeInstanceOf(VueGridAdapter);
    });

    describe('canHandle', () => {
      it('should return false if no renderer/editor registered', () => {
        const adapter = new VueGridAdapter();
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'unregisteredField');

        expect(adapter.canHandle(element)).toBe(false);
      });

      it('should return true if renderer registered', () => {
        const adapter = new VueGridAdapter();
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'registeredField');

        registerColumnRenderer(element, () => null as unknown as VNode);

        expect(adapter.canHandle(element)).toBe(true);
      });
    });

    describe('createRenderer', () => {
      it('should return undefined if no renderer registered', () => {
        const adapter = new VueGridAdapter();
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'noRenderer');

        const result = adapter.createRenderer(element);
        expect(result).toBeUndefined();
      });
    });

    describe('createEditor', () => {
      it('should return undefined if no editor registered', () => {
        const adapter = new VueGridAdapter();
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'noEditor');

        const result = adapter.createEditor(element);
        expect(result).toBeUndefined();
      });
    });

    describe('type defaults', () => {
      it('should have setTypeDefaults method', () => {
        expect(VueGridAdapter.prototype.setTypeDefaults).toBeDefined();
      });

      it('should have getTypeDefault method', () => {
        expect(VueGridAdapter.prototype.getTypeDefault).toBeDefined();
      });

      it('should return undefined when no type defaults are set', () => {
        const adapter = new VueGridAdapter();
        expect(adapter.getTypeDefault('country')).toBeUndefined();
      });

      it('should return undefined for unregistered type', () => {
        const adapter = new VueGridAdapter();
        adapter.setTypeDefaults({
          country: { renderer: () => null as unknown as VNode },
        });
        expect(adapter.getTypeDefault('unknown')).toBeUndefined();
      });

      it('should return type default with renderer', () => {
        const adapter = new VueGridAdapter();
        const renderer = () => null as unknown as VNode;
        adapter.setTypeDefaults({
          country: { renderer },
        });

        const result = adapter.getTypeDefault('country');
        expect(result).toBeDefined();
        expect(result?.renderer).toBeDefined();
      });

      it('should return type default with editor', () => {
        const adapter = new VueGridAdapter();
        const editor = () => null as unknown as VNode;
        adapter.setTypeDefaults({
          status: { editor },
        });

        const result = adapter.getTypeDefault('status');
        expect(result).toBeDefined();
        expect(result?.editor).toBeDefined();
      });

      it('should return type default with editorParams', () => {
        const adapter = new VueGridAdapter();
        const editorParams = { options: ['A', 'B'] };
        adapter.setTypeDefaults({
          category: { editorParams },
        });

        const result = adapter.getTypeDefault('category');
        expect(result).toBeDefined();
        expect(result?.editorParams).toEqual(editorParams);
      });

      it('should clear type defaults when set to null', () => {
        const adapter = new VueGridAdapter();
        adapter.setTypeDefaults({
          country: { renderer: () => null as unknown as VNode },
        });
        expect(adapter.getTypeDefault('country')).toBeDefined();

        adapter.setTypeDefaults(null);
        expect(adapter.getTypeDefault('country')).toBeUndefined();
      });
    });
  });
});
