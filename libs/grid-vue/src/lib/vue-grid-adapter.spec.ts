/**
 * Tests for GridAdapter registration and lookup
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, h, type VNode } from 'vue';

import { detailRegistry } from './detail-panel-registry';
import { cardRegistry } from './responsive-card-registry';
import {
  clearFieldRegistries,
  getColumnEditor,
  getColumnRenderer,
  getRegisteredFields,
  GridAdapter,
  isVueComponent,
  registerColumnEditor,
  registerColumnRenderer,
} from './vue-grid-adapter';

describe('GridAdapter', () => {
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

  describe('GridAdapter class', () => {
    it('should be a valid class', () => {
      expect(GridAdapter).toBeDefined();
      expect(typeof GridAdapter).toBe('function');
    });

    it('should have required interface methods', () => {
      expect(GridAdapter.prototype.canHandle).toBeDefined();
      expect(GridAdapter.prototype.createRenderer).toBeDefined();
      expect(GridAdapter.prototype.createEditor).toBeDefined();
      expect(GridAdapter.prototype.cleanup).toBeDefined();
    });

    it('should instantiate correctly', () => {
      const adapter = new GridAdapter();
      expect(adapter).toBeInstanceOf(GridAdapter);
    });

    describe('canHandle', () => {
      it('should return false if no renderer/editor registered', () => {
        const adapter = new GridAdapter();
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'unregisteredField');

        expect(adapter.canHandle(element)).toBe(false);
      });

      it('should return true if renderer registered', () => {
        const adapter = new GridAdapter();
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'registeredField');

        registerColumnRenderer(element, () => null as unknown as VNode);

        expect(adapter.canHandle(element)).toBe(true);
      });
    });

    describe('createRenderer', () => {
      it('should return undefined if no renderer registered', () => {
        const adapter = new GridAdapter();
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'noRenderer');

        const result = adapter.createRenderer(element);
        expect(result).toBeUndefined();
      });
    });

    describe('createEditor', () => {
      it('should return undefined if no editor registered', () => {
        const adapter = new GridAdapter();
        const element = document.createElement('tbw-grid-column');
        element.setAttribute('field', 'noEditor');

        const result = adapter.createEditor(element);
        expect(result).toBeUndefined();
      });
    });

    describe('type defaults', () => {
      it('should have setTypeDefaults method', () => {
        expect(GridAdapter.prototype.setTypeDefaults).toBeDefined();
      });

      it('should have getTypeDefault method', () => {
        expect(GridAdapter.prototype.getTypeDefault).toBeDefined();
      });

      it('should return undefined when no type defaults are set', () => {
        const adapter = new GridAdapter();
        expect(adapter.getTypeDefault('country')).toBeUndefined();
      });

      it('should return undefined for unregistered type', () => {
        const adapter = new GridAdapter();
        adapter.setTypeDefaults({
          country: { renderer: () => null as unknown as VNode },
        });
        expect(adapter.getTypeDefault('unknown')).toBeUndefined();
      });

      it('should return type default with renderer', () => {
        const adapter = new GridAdapter();
        const renderer = () => null as unknown as VNode;
        adapter.setTypeDefaults({
          country: { renderer },
        });

        const result = adapter.getTypeDefault('country');
        expect(result).toBeDefined();
        expect(result?.renderer).toBeDefined();
      });

      it('should return type default with editor', () => {
        const adapter = new GridAdapter();
        const editor = () => null as unknown as VNode;
        adapter.setTypeDefaults({
          status: { editor },
        });

        const result = adapter.getTypeDefault('status');
        expect(result).toBeDefined();
        expect(result?.editor).toBeDefined();
      });

      it('should return type default with editorParams', () => {
        const adapter = new GridAdapter();
        const editorParams = { options: ['A', 'B'] };
        adapter.setTypeDefaults({
          category: { editorParams },
        });

        const result = adapter.getTypeDefault('category');
        expect(result).toBeDefined();
        expect(result?.editorParams).toEqual(editorParams);
      });

      it('should clear type defaults when set to null', () => {
        const adapter = new GridAdapter();
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

  // #region cleanup

  describe('cleanup', () => {
    it('should not throw when called with no mounted views', () => {
      const adapter = new GridAdapter();
      expect(() => adapter.cleanup()).not.toThrow();
    });

    it('should be callable multiple times safely', () => {
      const adapter = new GridAdapter();
      adapter.cleanup();
      adapter.cleanup();
      // Should not throw
    });
  });

  // #endregion

  // #region parseDetailElement

  describe('parseDetailElement', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      container.remove();
    });

    it('should return undefined when element has no parent grid', () => {
      const adapter = new GridAdapter();
      const detailElement = document.createElement('tbw-grid-detail');
      // Not inside a tbw-grid
      container.appendChild(detailElement);

      const result = adapter.parseDetailElement(detailElement);
      expect(result).toBeUndefined();
    });

    it('should return undefined when grid has no tbw-grid-detail child', () => {
      const adapter = new GridAdapter();
      const gridElement = document.createElement('tbw-grid');
      const someOtherElement = document.createElement('div');
      gridElement.appendChild(someOtherElement);
      container.appendChild(gridElement);

      // Pass the div, which is inside a grid but not a detail element
      const result = adapter.parseDetailElement(someOtherElement);
      expect(result).toBeUndefined();
    });

    it('should return undefined when detail element has no registered renderer', () => {
      const adapter = new GridAdapter();
      const gridElement = document.createElement('tbw-grid');
      const detailElement = document.createElement('tbw-grid-detail');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      const result = adapter.parseDetailElement(detailElement);
      expect(result).toBeUndefined();
    });
  });

  // #endregion

  // #region parseResponsiveCardElement

  describe('parseResponsiveCardElement', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      container.remove();
    });

    it('should return undefined when element has no parent grid', () => {
      const adapter = new GridAdapter();
      const cardElement = document.createElement('tbw-grid-responsive-card');
      container.appendChild(cardElement);

      const result = adapter.parseResponsiveCardElement(cardElement);
      expect(result).toBeUndefined();
    });

    it('should return undefined when grid has no tbw-grid-responsive-card child', () => {
      const adapter = new GridAdapter();
      const gridElement = document.createElement('tbw-grid');
      const someOtherElement = document.createElement('div');
      gridElement.appendChild(someOtherElement);
      container.appendChild(gridElement);

      const result = adapter.parseResponsiveCardElement(someOtherElement);
      expect(result).toBeUndefined();
    });

    it('should return undefined when card element has no registered renderer', () => {
      const adapter = new GridAdapter();
      const gridElement = document.createElement('tbw-grid');
      const cardElement = document.createElement('tbw-grid-responsive-card');
      gridElement.appendChild(cardElement);
      container.appendChild(gridElement);

      const result = adapter.parseResponsiveCardElement(cardElement);
      expect(result).toBeUndefined();
    });
  });

  // #endregion

  // #region createRenderer / createEditor

  describe('createRenderer', () => {
    beforeEach(() => {
      clearFieldRegistries();
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should return undefined-ish when no renderer is registered', () => {
      const adapter = new GridAdapter();
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'noRenderer');

      const renderer = adapter.createRenderer(element);
      // No renderer registered, returns undefined cast
      expect(renderer).toBeFalsy();
    });

    it('should return a function when renderer is registered', () => {
      const adapter = new GridAdapter();
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'hasRenderer');

      registerColumnRenderer(element, () => h('span', 'hello'));

      const renderer = adapter.createRenderer(element);
      expect(typeof renderer).toBe('function');
    });

    it('should render Vue content into a container element', () => {
      const adapter = new GridAdapter();
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'rendered');

      registerColumnRenderer(element, (ctx: any) => h('span', String(ctx.value)));

      const renderer = adapter.createRenderer(element);
      const ctx = { value: 'test-value', row: {}, column: { field: 'rendered' } };
      const container = (renderer as (...args: unknown[]) => HTMLElement)(ctx);
    });

    it('should use cell caching when cellEl is provided', () => {
      const adapter = new GridAdapter();
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'cached');

      registerColumnRenderer(element, (ctx: any) => h('span', String(ctx.value)));

      const renderer = adapter.createRenderer(element);
      const cellEl = document.createElement('div');
      const ctx1 = { value: 'first', row: {}, column: { field: 'cached' }, cellEl };
      const container1 = (renderer as (...args: unknown[]) => HTMLElement)(ctx1);

      // Second call with same cellEl should return cached container
      const ctx2 = { value: 'second', row: {}, column: { field: 'cached' }, cellEl };
      const container2 = (renderer as (...args: unknown[]) => HTMLElement)(ctx2);

      expect(container2).toBe(container1);
    });
  });

  describe('createEditor', () => {
    beforeEach(() => {
      clearFieldRegistries();
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should return undefined-ish when no editor is registered', () => {
      const adapter = new GridAdapter();
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'noEditor');

      const editor = adapter.createEditor(element);
      expect(editor).toBeFalsy();
    });

    it('should return a function when editor is registered', () => {
      const adapter = new GridAdapter();
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'hasEditor');

      registerColumnEditor(element, () => h('input'));

      const editor = adapter.createEditor(element);
      expect(typeof editor).toBe('function');
    });

    it('should render Vue editor into a container element', () => {
      const adapter = new GridAdapter();
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'editField');

      registerColumnEditor(element, () => h('input', { type: 'text' }));

      const editor = adapter.createEditor(element);
      const ctx = { value: 'edit-me', row: {}, column: { field: 'editField' } };
      const container = (editor as (...args: unknown[]) => HTMLElement)(ctx);
    });
  });

  // #endregion

  // #region cleanup / unmount / releaseCell

  describe('cleanup with mounted views', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should unmount all mounted renderer views', () => {
      const adapter = new GridAdapter();
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'cleanupTest');

      registerColumnRenderer(element, () => h('span', 'rendered'));

      const renderer = adapter.createRenderer(element);
      // Create a view without cellEl so it goes into mountedViews
      const ctx = { value: 'val', row: {}, column: { field: 'cleanupTest' } };
      (renderer as (...args: unknown[]) => unknown)(ctx);

      // Cleanup should not throw and should clear internal state
      expect(() => adapter.cleanup()).not.toThrow();

      // Call again to verify it's safe after cleanup
      expect(() => adapter.cleanup()).not.toThrow();
    });

    it('should unmount all editor views', () => {
      const adapter = new GridAdapter();
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'cleanupEditor');

      registerColumnEditor(element, () => h('input'));

      const editor = adapter.createEditor(element);
      const ctx = { value: 'val', row: {}, column: { field: 'cleanupEditor' } };
      (editor as (...args: unknown[]) => unknown)(ctx);

      expect(() => adapter.cleanup()).not.toThrow();
    });
  });

  describe('unmount', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should unmount a specific container', () => {
      const adapter = new GridAdapter();
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'unmountTest');

      registerColumnRenderer(element, () => h('span', 'content'));

      const renderer = adapter.createRenderer(element);
      const ctx = { value: 'val', row: {}, column: { field: 'unmountTest' } };
      const container = (renderer as (...args: unknown[]) => HTMLElement)(ctx);

      // Should not throw
      expect(() => adapter.unmount(container)).not.toThrow();
    });

    it('should not throw for unknown container', () => {
      const adapter = new GridAdapter();
      const unknownContainer = document.createElement('div');

      expect(() => adapter.unmount(unknownContainer)).not.toThrow();
    });
  });

  describe('releaseCell', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should release editor views inside a cell element', () => {
      const adapter = new GridAdapter();
      const element = document.createElement('tbw-grid-column');
      element.setAttribute('field', 'releaseTest');

      registerColumnEditor(element, () => h('input'));

      const editor = adapter.createEditor(element);
      const ctx = { value: 'val', row: {}, column: { field: 'releaseTest' } };
      const editorContainer = (editor as (...args: unknown[]) => HTMLElement)(ctx);

      // Simulate cell containing the editor
      const cellEl = document.createElement('div');
      cellEl.appendChild(editorContainer);

      expect(() => adapter.releaseCell(cellEl)).not.toThrow();
    });

    it('should not throw for cell with no editors', () => {
      const adapter = new GridAdapter();
      const cellEl = document.createElement('div');

      expect(() => adapter.releaseCell(cellEl)).not.toThrow();
    });
  });

  // #endregion

  // #region processGridConfig (header/loading renderers)

  describe('processGridConfig - headerRenderer', () => {
    it('should wrap Vue component headerRenderer', () => {
      const adapter = new GridAdapter();
      const HeaderComp = defineComponent({
        setup() {
          return () => h('div', 'header');
        },
      });
      const config = {
        columns: [{ field: 'name', headerRenderer: HeaderComp }],
      };
      const result = adapter.processGridConfig(config);
      expect(result.columns![0].headerRenderer).toBeDefined();
      expect(result.columns![0].headerRenderer).not.toBe(HeaderComp);
    });

    it('should wrap VNode-returning headerRenderer function', () => {
      const adapter = new GridAdapter();
      const headerFn = (_ctx: any) => h('div', 'header');
      const config = {
        columns: [{ field: 'name', headerRenderer: headerFn }],
      };
      const result = adapter.processGridConfig(config);
      expect(result.columns![0].headerRenderer).toBeDefined();
      expect(result.columns![0].headerRenderer).not.toBe(headerFn);
    });

    it('should wrap Vue component headerLabelRenderer', () => {
      const adapter = new GridAdapter();
      const LabelComp = defineComponent({
        setup() {
          return () => h('span', 'label');
        },
      });
      const config = {
        columns: [{ field: 'name', headerLabelRenderer: LabelComp }],
      };
      const result = adapter.processGridConfig(config);
      expect(result.columns![0].headerLabelRenderer).toBeDefined();
      expect(result.columns![0].headerLabelRenderer).not.toBe(LabelComp);
    });

    it('should wrap VNode-returning headerLabelRenderer function', () => {
      const adapter = new GridAdapter();
      const labelFn = (_ctx: any) => h('span', 'label');
      const config = {
        columns: [{ field: 'name', headerLabelRenderer: labelFn }],
      };
      const result = adapter.processGridConfig(config);
      expect(result.columns![0].headerLabelRenderer).toBeDefined();
      expect(result.columns![0].headerLabelRenderer).not.toBe(labelFn);
    });
  });

  describe('processGridConfig - loadingRenderer', () => {
    it('should wrap Vue component loadingRenderer', () => {
      const adapter = new GridAdapter();
      const LoadingComp = defineComponent({
        setup() {
          return () => h('div', 'loading...');
        },
      });
      const config = {
        columns: [{ field: 'name' }],
        loadingRenderer: LoadingComp,
      };
      const result = adapter.processGridConfig(config);
      expect(result.loadingRenderer).toBeDefined();
      expect(result.loadingRenderer).not.toBe(LoadingComp);
    });

    it('should wrap VNode-returning loadingRenderer function', () => {
      const adapter = new GridAdapter();
      const loadingFn = (_ctx: any) => h('div', 'loading...');
      const config = {
        columns: [{ field: 'name' }],
        loadingRenderer: loadingFn,
      };
      const result = adapter.processGridConfig(config);
      expect(result.loadingRenderer).toBeDefined();
      expect(result.loadingRenderer).not.toBe(loadingFn);
    });
  });

  // #endregion

  // #region getTypeDefault with execution

  describe('getTypeDefault - renderer/editor invocation', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should return type default with working renderer function', () => {
      const adapter = new GridAdapter();
      adapter.setTypeDefaults({
        country: { renderer: (ctx: any) => h('span', `Flag: ${ctx.value}`) },
      });

      const result = adapter.getTypeDefault('country');
      expect(result).toBeDefined();
      expect(result?.renderer).toBeDefined();

      // Actually invoke the renderer
      const ctx = { value: 'US', row: {}, column: { field: 'country' } };
      const container = (result!.renderer as (...args: unknown[]) => HTMLElement)(ctx);
      expect(container).toBeInstanceOf(HTMLElement);
    });

    it('should return type default with working editor function', () => {
      const adapter = new GridAdapter();
      adapter.setTypeDefaults({
        status: { editor: (_ctx: any) => h('select', [h('option', 'Active'), h('option', 'Inactive')]) },
      });

      const result = adapter.getTypeDefault('status');
      expect(result).toBeDefined();
      expect(result?.editor).toBeDefined();

      // Actually invoke the editor
      const ctx = { value: 'Active', row: {}, column: { field: 'status' } };
      const container = (result!.editor as (...args: unknown[]) => HTMLElement)(ctx);
      expect(container).toBeInstanceOf(HTMLElement);
    });

    it('should return type default with filterPanelRenderer', () => {
      const adapter = new GridAdapter();
      adapter.setTypeDefaults({
        custom: { filterPanelRenderer: (_params: any) => h('div', 'filter panel') },
      });

      const result = adapter.getTypeDefault('custom');
      expect(result).toBeDefined();
      expect(result?.filterPanelRenderer).toBeDefined();

      // Actually invoke the filter panel renderer
      const container = document.createElement('div');
      const params = { column: { field: 'custom' }, currentFilter: null };
      (result!.filterPanelRenderer as (...args: unknown[]) => void)(container, params);
      expect(container.children.length).toBeGreaterThan(0);
    });
  });

  // #endregion

  // #region processGridConfig - typeDefaults processing

  describe('processGridConfig - typeDefaults', () => {
    it('should process typeDefaults with Vue component editor', () => {
      const adapter = new GridAdapter();
      const EditorComp = defineComponent({
        setup() {
          return () => h('input');
        },
      });
      const config = {
        columns: [{ field: 'name' }],
        typeDefaults: {
          custom: { editor: EditorComp },
        },
      };
      const result = adapter.processGridConfig(config);
      expect(result.typeDefaults).toBeDefined();
      expect(result.typeDefaults!['custom'].editor).toBeDefined();
    });

    it('should process typeDefaults with filterPanelRenderer', () => {
      const adapter = new GridAdapter();
      const filterFn = (_params: any) => h('div', 'filter');
      const config = {
        columns: [{ field: 'name' }],
        typeDefaults: {
          custom: { filterPanelRenderer: filterFn },
        },
      };
      const result = adapter.processGridConfig(config);
      expect(result.typeDefaults).toBeDefined();
      expect(result.typeDefaults!['custom'].filterPanelRenderer).toBeDefined();
    });

    it('should preserve editorParams in typeDefaults', () => {
      const adapter = new GridAdapter();
      const config = {
        columns: [{ field: 'name' }],
        typeDefaults: {
          custom: { editorParams: { options: ['A', 'B'] } },
        },
      };
      const result = adapter.processGridConfig(config);
      expect(result.typeDefaults!['custom'].editorParams).toEqual({ options: ['A', 'B'] });
    });
  });

  // #endregion

  // #region parseDetailElement / parseResponsiveCardElement with registered renderers

  describe('parseDetailElement with registered renderer', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      container.remove();
    });

    it('should return renderer function when detail renderer is registered', () => {
      const adapter = new GridAdapter();
      const gridElement = document.createElement('tbw-grid');
      const detailElement = document.createElement('tbw-grid-detail');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      // Register a detail renderer
      detailRegistry.set(detailElement, (ctx: any) => [h('div', `Row: ${ctx.rowIndex}`)]);

      const result = adapter.parseDetailElement(detailElement);
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should produce a container with rendered content', () => {
      const adapter = new GridAdapter();
      const gridElement = document.createElement('tbw-grid');
      const detailElement = document.createElement('tbw-grid-detail');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      detailRegistry.set(detailElement, (_ctx: any) => [h('div', 'detail content')]);

      const renderFn = adapter.parseDetailElement(detailElement)!;
      const result = renderFn({ id: 1 }, 0);
      expect(result).toBeInstanceOf(HTMLElement);
      expect(result.className).toBe('vue-detail-panel');
    });
  });

  describe('parseResponsiveCardElement with registered renderer', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      container.remove();
    });

    it('should return renderer function when card renderer is registered', () => {
      const adapter = new GridAdapter();
      const gridElement = document.createElement('tbw-grid');
      const cardElement = document.createElement('tbw-grid-responsive-card');
      gridElement.appendChild(cardElement);
      container.appendChild(gridElement);

      cardRegistry.set(cardElement, (_ctx: any) => [h('div', 'card')]);

      const result = adapter.parseResponsiveCardElement(cardElement);
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should produce a container with card content', () => {
      const adapter = new GridAdapter();
      const gridElement = document.createElement('tbw-grid');
      const cardElement = document.createElement('tbw-grid-responsive-card');
      gridElement.appendChild(cardElement);
      container.appendChild(gridElement);

      cardRegistry.set(cardElement, (_ctx: any) => [h('div', 'card content')]);

      const renderFn = adapter.parseResponsiveCardElement(cardElement)!;
      const result = renderFn({ id: 1 }, 0);
      expect(result).toBeInstanceOf(HTMLElement);
      expect(result.className).toBe('vue-responsive-card');
    });
  });

  // #endregion

  // #region GridAdapter alias

  describe('GridAdapter alias', () => {
    it('should be the same as GridAdapter', () => {
      expect(GridAdapter).toBe(GridAdapter);
    });

    it('should produce instances with same prototype', () => {
      const adapter = new GridAdapter();
      expect(adapter).toBeInstanceOf(GridAdapter);
    });
  });

  // #endregion

  // #region Config-based renderer/editor invocation

  describe('processGridConfig - invoke wrapped renderers', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should produce working DOM from wrapped VNode renderer', () => {
      const adapter = new GridAdapter();
      const vueRenderer = (ctx: any) => h('span', `Value: ${ctx.value}`);
      const config = { columns: [{ field: 'name', renderer: vueRenderer }] };
      const result = adapter.processGridConfig(config);

      const ctx = { value: 'Alice', row: {}, column: { field: 'name' } };
      const container = (result.columns![0].renderer as (...args: unknown[]) => HTMLElement)(ctx);
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.className).toBe('vue-cell-renderer');
    });

    it('should produce working DOM from wrapped Vue component renderer', () => {
      const adapter = new GridAdapter();
      const Badge = defineComponent({
        props: { value: String },
        setup(props) {
          return () => h('span', props.value);
        },
      });
      const config = { columns: [{ field: 'status', renderer: Badge }] };
      const result = adapter.processGridConfig(config);

      const ctx = { value: 'Active', row: {}, column: { field: 'status' } };
      const container = (result.columns![0].renderer as (...args: unknown[]) => HTMLElement)(ctx);
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.className).toBe('vue-cell-renderer');
    });

    it('should use cellEl cache for config VNode renderer', () => {
      const adapter = new GridAdapter();
      const vueRenderer = (ctx: any) => h('span', String(ctx.value));
      const config = { columns: [{ field: 'name', renderer: vueRenderer }] };
      const result = adapter.processGridConfig(config);
      const wrappedRenderer = result.columns![0].renderer as (...args: unknown[]) => HTMLElement;

      const cellEl = document.createElement('div');
      const ctx1 = { value: 'first', row: {}, column: { field: 'name' }, cellEl };
      const container1 = wrappedRenderer(ctx1);

      const ctx2 = { value: 'second', row: {}, column: { field: 'name' }, cellEl };
      const container2 = wrappedRenderer(ctx2);

      expect(container2).toBe(container1);
    });

    it('should use cellEl cache for config component renderer', () => {
      const adapter = new GridAdapter();
      const Badge = defineComponent({
        props: { value: String },
        setup(props) {
          return () => h('span', props.value);
        },
      });
      const config = { columns: [{ field: 'status', renderer: Badge }] };
      const result = adapter.processGridConfig(config);
      const wrappedRenderer = result.columns![0].renderer as (...args: unknown[]) => HTMLElement;

      const cellEl = document.createElement('div');
      const ctx1 = { value: 'Active', row: {}, column: { field: 'status' }, cellEl };
      const container1 = wrappedRenderer(ctx1);

      const ctx2 = { value: 'Inactive', row: {}, column: { field: 'status' }, cellEl };
      const container2 = wrappedRenderer(ctx2);

      expect(container2).toBe(container1);
    });

    it('should produce working DOM from wrapped VNode editor', () => {
      const adapter = new GridAdapter();
      const vueEditor = (ctx: any) => h('input', { value: ctx.value });
      const config = { columns: [{ field: 'name', editor: vueEditor }] };
      const result = adapter.processGridConfig(config);

      const ctx = { value: 'Bob', row: {}, column: { field: 'name' } };
      const container = (result.columns![0].editor as (...args: unknown[]) => HTMLElement)(ctx);
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.className).toBe('vue-cell-editor');
    });

    it('should produce working DOM from wrapped Vue component editor', () => {
      const adapter = new GridAdapter();
      const EditorComp = defineComponent({
        props: { value: String },
        setup(props) {
          return () => h('input', { value: props.value });
        },
      });
      const config = { columns: [{ field: 'name', editor: EditorComp }] };
      const result = adapter.processGridConfig(config);

      const ctx = { value: 'Bob', row: {}, column: { field: 'name' } };
      const container = (result.columns![0].editor as (...args: unknown[]) => HTMLElement)(ctx);
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.className).toBe('vue-cell-editor');
    });

    it('should produce working DOM from wrapped VNode headerRenderer', () => {
      const adapter = new GridAdapter();
      const headerFn = (ctx: any) => h('div', `Header: ${ctx.value}`);
      const config = { columns: [{ field: 'name', headerRenderer: headerFn }] };
      const result = adapter.processGridConfig(config);

      const ctx = { column: { field: 'name' }, value: 'Name', sortState: null, filterActive: false };
      const container = (result.columns![0].headerRenderer as (...args: unknown[]) => HTMLElement)(ctx);
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.className).toBe('vue-header-renderer');
    });

    it('should produce working DOM from wrapped component headerRenderer', () => {
      const adapter = new GridAdapter();
      const HeaderComp = defineComponent({
        props: { value: String },
        setup(props) {
          return () => h('div', props.value);
        },
      });
      const config = { columns: [{ field: 'name', headerRenderer: HeaderComp }] };
      const result = adapter.processGridConfig(config);

      const ctx = { column: { field: 'name' }, value: 'Name', sortState: null, filterActive: false };
      const container = (result.columns![0].headerRenderer as (...args: unknown[]) => HTMLElement)(ctx);
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.className).toBe('vue-header-renderer');
    });

    it('should produce working DOM from wrapped VNode headerLabelRenderer', () => {
      const adapter = new GridAdapter();
      const labelFn = (ctx: any) => h('span', ctx.value);
      const config = { columns: [{ field: 'name', headerLabelRenderer: labelFn }] };
      const result = adapter.processGridConfig(config);

      const ctx = { column: { field: 'name' }, value: 'Name' };
      const container = (result.columns![0].headerLabelRenderer as (...args: unknown[]) => HTMLElement)(ctx);
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.className).toBe('vue-header-label-renderer');
    });

    it('should produce working DOM from wrapped component headerLabelRenderer', () => {
      const adapter = new GridAdapter();
      const LabelComp = defineComponent({
        props: { value: String },
        setup(props) {
          return () => h('span', props.value);
        },
      });
      const config = { columns: [{ field: 'name', headerLabelRenderer: LabelComp }] };
      const result = adapter.processGridConfig(config);

      const ctx = { column: { field: 'name' }, value: 'Name' };
      const container = (result.columns![0].headerLabelRenderer as (...args: unknown[]) => HTMLElement)(ctx);
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.className).toBe('vue-header-label-renderer');
    });

    it('should produce working DOM from wrapped VNode loadingRenderer', () => {
      const adapter = new GridAdapter();
      const loadingFn = (ctx: any) => h('div', `Loading ${ctx.size}`);
      const config = { columns: [{ field: 'name' }], loadingRenderer: loadingFn };
      const result = adapter.processGridConfig(config);

      const ctx = { size: 'large' };
      const container = (result.loadingRenderer as (...args: unknown[]) => HTMLElement)(ctx);
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.className).toBe('vue-loading-renderer');
    });

    it('should produce working DOM from wrapped component loadingRenderer', () => {
      const adapter = new GridAdapter();
      const LoadingComp = defineComponent({
        props: { size: String },
        setup(props) {
          return () => h('div', `Loading ${props.size}`);
        },
      });
      const config = { columns: [{ field: 'name' }], loadingRenderer: LoadingComp };
      const result = adapter.processGridConfig(config);

      const ctx = { size: 'large' };
      const container = (result.loadingRenderer as (...args: unknown[]) => HTMLElement)(ctx);
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.className).toBe('vue-loading-renderer');
    });

    it('should produce working DOM from typeDefaults VNode editor via processGridConfig', () => {
      const adapter = new GridAdapter();
      const editorFn = (ctx: any) => h('select', [h('option', ctx.value)]);
      const config = {
        columns: [{ field: 'status' }],
        typeDefaults: { status: { editor: editorFn } },
      };
      const result = adapter.processGridConfig(config);

      const ctx = { value: 'Active', row: {}, column: { field: 'status' } };
      const container = (result.typeDefaults!['status'].editor as (...args: unknown[]) => HTMLElement)(ctx);
      expect(container).toBeInstanceOf(HTMLElement);
    });

    it('should produce working DOM from typeDefaults filterPanelRenderer via processGridConfig', () => {
      const adapter = new GridAdapter();
      const filterFn = (_params: any) => h('div', 'filter panel');
      const config = {
        columns: [{ field: 'name' }],
        typeDefaults: { custom: { filterPanelRenderer: filterFn } },
      };
      const result = adapter.processGridConfig(config);

      const container = document.createElement('div');
      const params = { column: { field: 'name' }, currentFilter: null };
      (result.typeDefaults!['custom'].filterPanelRenderer as (...args: unknown[]) => void)(container, params);
      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should produce working DOM from typeDefaults component editor via processGridConfig', () => {
      const adapter = new GridAdapter();
      const EditorComp = defineComponent({
        setup() {
          return () => h('input');
        },
      });
      const config = {
        columns: [{ field: 'name' }],
        typeDefaults: { custom: { editor: EditorComp } },
      };
      const result = adapter.processGridConfig(config);

      const ctx = { value: '', row: {}, column: { field: 'name' } };
      const container = (result.typeDefaults!['custom'].editor as (...args: unknown[]) => HTMLElement)(ctx);
      expect(container).toBeInstanceOf(HTMLElement);
    });

    it('should produce working DOM from typeDefaults component renderer via processGridConfig', () => {
      const adapter = new GridAdapter();
      const RenderComp = defineComponent({
        props: { value: String },
        setup(props) {
          return () => h('span', props.value);
        },
      });
      const config = {
        columns: [{ field: 'name' }],
        typeDefaults: { custom: { renderer: RenderComp } },
      };
      const result = adapter.processGridConfig(config);

      const ctx = { value: 'test', row: {}, column: { field: 'name' } };
      const container = (result.typeDefaults!['custom'].renderer as (...args: unknown[]) => HTMLElement)(ctx);
      expect(container).toBeInstanceOf(HTMLElement);
    });
  });

  // #endregion

  // #region detail/card renderer invocation with empty vnodes

  describe('parseDetailElement - empty vnodes', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      container.remove();
    });

    it('should return empty container when renderer returns empty array', () => {
      const adapter = new GridAdapter();
      const gridElement = document.createElement('tbw-grid');
      const detailElement = document.createElement('tbw-grid-detail');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      detailRegistry.set(detailElement, () => []);

      const renderFn = adapter.parseDetailElement(detailElement)!;
      const result = renderFn({ id: 1 }, 0);
      expect(result).toBeInstanceOf(HTMLElement);
      expect(result.className).toBe('vue-detail-panel');
      expect(result.children.length).toBe(0);
    });
  });

  describe('parseResponsiveCardElement - empty vnodes', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      container.remove();
    });

    it('should return empty container when renderer returns empty array', () => {
      const adapter = new GridAdapter();
      const gridElement = document.createElement('tbw-grid');
      const cardElement = document.createElement('tbw-grid-responsive-card');
      gridElement.appendChild(cardElement);
      container.appendChild(gridElement);

      cardRegistry.set(cardElement, () => []);

      const renderFn = adapter.parseResponsiveCardElement(cardElement)!;
      const result = renderFn({ id: 1 }, 0);
      expect(result).toBeInstanceOf(HTMLElement);
      expect(result.className).toBe('vue-responsive-card');
      expect(result.children.length).toBe(0);
    });
  });

  // #endregion
});
