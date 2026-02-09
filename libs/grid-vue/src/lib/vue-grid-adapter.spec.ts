/**
 * Tests for VueGridAdapter registration and lookup
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, h, type VNode } from 'vue';

import {
  clearFieldRegistries,
  getColumnEditor,
  getColumnRenderer,
  getRegisteredFields,
  GridAdapter,
  isVueComponent,
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

  // #region isVueComponent

  describe('isVueComponent', () => {
    it('should return false for null/undefined', () => {
      expect(isVueComponent(null)).toBe(false);
      expect(isVueComponent(undefined)).toBe(false);
    });

    it('should return false for plain arrow function', () => {
      const fn = () => 'hello';
      expect(isVueComponent(fn)).toBe(false);
    });

    it('should return false for function expression', () => {
      // eslint-disable-next-line prefer-arrow-callback
      expect(
        isVueComponent(function namedFn() {
          return 'hello';
        }),
      ).toBe(false);
    });

    it('should return false for primitive values', () => {
      expect(isVueComponent(42)).toBe(false);
      expect(isVueComponent('string')).toBe(false);
      expect(isVueComponent(true)).toBe(false);
    });

    it('should return false for plain objects', () => {
      expect(isVueComponent({ foo: 'bar' })).toBe(false);
    });

    it('should return true for object with __name (SFC compiled)', () => {
      const sfc = {
        __name: 'MyComponent',
        setup() {
          return {};
        },
      };
      expect(isVueComponent(sfc)).toBe(true);
    });

    it('should return true for object with setup function (Composition API)', () => {
      const comp = {
        setup() {
          return {};
        },
      };
      expect(isVueComponent(comp)).toBe(true);
    });

    it('should return true for object with render function (Options API)', () => {
      const comp = {
        render() {
          return h('div');
        },
      };
      expect(isVueComponent(comp)).toBe(true);
    });

    it('should return true for defineComponent result', () => {
      const comp = defineComponent({
        setup() {
          return () => h('div', 'test');
        },
      });
      expect(isVueComponent(comp)).toBe(true);
    });

    it('should return true for ES6 class', () => {
      class MyComponent {}
      expect(isVueComponent(MyComponent)).toBe(true);
    });
  });

  // #endregion

  // #region processGridConfig

  describe('processGridConfig', () => {
    it('should pass through config without columns unchanged', () => {
      const adapter = new GridAdapter();
      const config = { fitMode: 'fill' as const };
      const result = adapter.processGridConfig(config);
      expect(result.fitMode).toBe('fill');
    });

    it('should pass through columns with no renderer/editor unchanged', () => {
      const adapter = new GridAdapter();
      const config = {
        columns: [
          { field: 'name', header: 'Name' },
          { field: 'age', header: 'Age' },
        ],
      };
      const result = adapter.processGridConfig(config);
      expect(result.columns).toHaveLength(2);
      expect(result.columns![0].field).toBe('name');
      expect(result.columns![1].field).toBe('age');
    });

    it('should wrap VNode-returning renderer function', () => {
      const adapter = new GridAdapter();
      const vueRenderer = (ctx: any) => h('span', ctx.value);
      const config = {
        columns: [{ field: 'status', renderer: vueRenderer }],
      };
      const result = adapter.processGridConfig(config);
      // The renderer should have been wrapped (not the same function reference)
      expect(result.columns![0].renderer).toBeDefined();
      expect(result.columns![0].renderer).not.toBe(vueRenderer);
    });

    it('should wrap Vue component renderer', () => {
      const adapter = new GridAdapter();
      const StatusBadge = defineComponent({
        props: { value: String },
        setup(props) {
          return () => h('span', props.value);
        },
      });
      const config = {
        columns: [{ field: 'status', renderer: StatusBadge }],
      };
      const result = adapter.processGridConfig(config);
      expect(result.columns![0].renderer).toBeDefined();
      expect(result.columns![0].renderer).not.toBe(StatusBadge);
    });

    it('should wrap VNode-returning editor function', () => {
      const adapter = new GridAdapter();
      const vueEditor = (ctx: any) => h('input', { value: ctx.value });
      const config = {
        columns: [{ field: 'name', editor: vueEditor }],
      };
      const result = adapter.processGridConfig(config);
      expect(result.columns![0].editor).toBeDefined();
      expect(result.columns![0].editor).not.toBe(vueEditor);
    });

    it('should wrap Vue component editor', () => {
      const adapter = new GridAdapter();
      const StatusEditor = defineComponent({
        props: { value: String },
        setup(props) {
          return () => h('select', props.value);
        },
      });
      const config = {
        columns: [{ field: 'status', editor: StatusEditor }],
      };
      const result = adapter.processGridConfig(config);
      expect(result.columns![0].editor).toBeDefined();
      expect(result.columns![0].editor).not.toBe(StatusEditor);
    });

    it('should be idempotent - double processing is safe', () => {
      const adapter = new GridAdapter();
      const vueRenderer = (ctx: any) => h('span', ctx.value);
      const config = {
        columns: [{ field: 'status', renderer: vueRenderer }],
      };
      const first = adapter.processGridConfig(config);
      const second = adapter.processGridConfig(first as any);
      // Should not throw and columns should survive
      expect(second.columns).toHaveLength(1);
      expect(second.columns![0].renderer).toBeDefined();
    });

    it('should process typeDefaults with Vue renderers', () => {
      const adapter = new GridAdapter();
      const vueRenderer = (ctx: any) => h('span', ctx.value);
      const config = {
        columns: [{ field: 'name' }],
        typeDefaults: {
          country: { renderer: vueRenderer },
        },
      };
      const result = adapter.processGridConfig(config);
      expect(result.typeDefaults).toBeDefined();
      expect(result.typeDefaults!['country']).toBeDefined();
      expect(result.typeDefaults!['country'].renderer).toBeDefined();
    });

    it('should process typeDefaults with Vue component renderers', () => {
      const adapter = new GridAdapter();
      const CountryBadge = defineComponent({
        props: { value: String },
        setup(props) {
          return () => h('span', props.value);
        },
      });
      const config = {
        columns: [{ field: 'country' }],
        typeDefaults: {
          country: { renderer: CountryBadge },
        },
      };
      const result = adapter.processGridConfig(config);
      expect(result.typeDefaults!['country'].renderer).toBeDefined();
      expect(result.typeDefaults!['country'].renderer).not.toBe(CountryBadge);
    });

    it('should preserve non-renderer/editor column properties', () => {
      const adapter = new GridAdapter();
      const config = {
        columns: [
          {
            field: 'name',
            header: 'Full Name',
            width: 200,
            sortable: true,
            renderer: (ctx: any) => h('span', ctx.value),
          },
        ],
      };
      const result = adapter.processGridConfig(config);
      expect(result.columns![0].field).toBe('name');
      expect(result.columns![0].header).toBe('Full Name');
      expect(result.columns![0].width).toBe(200);
      expect(result.columns![0].sortable).toBe(true);
    });
  });

  // #endregion
});
