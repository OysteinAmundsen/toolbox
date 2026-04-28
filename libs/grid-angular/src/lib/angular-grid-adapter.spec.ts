/**
 * Tests for the Angular GridAdapter.
 *
 * The grid-angular package deliberately avoids Angular TestBed (see
 * `angular-grid-adapter.conformance.spec.ts` and the other `.spec.ts` files
 * in this directory). To exercise the adapter without bootstrapping the full
 * Angular runtime, we:
 *
 * 1. Mock `@angular/core`'s `createComponent` so it returns a fake
 *    `ComponentRef` whose `setInput` / `detectChanges` are spies.
 * 2. Mock the template registry getters (`grid-column-view.directive`,
 *    `grid-column-editor.directive`, `grid-detail-view.directive`,
 *    `grid-tool-panel.directive`, `grid-responsive-card.directive`,
 *    `grid-form-array.directive`, `structural-directives`) so individual tests
 *    can decide whether a template is registered for a given element.
 * 3. Construct the adapter with hand-rolled mock `EnvironmentInjector`,
 *    `ApplicationRef`, and `ViewContainerRef` whose `createEmbeddedView`
 *    returns a fake `EmbeddedViewRef`.
 *
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import type { ApplicationRef, EnvironmentInjector, ViewContainerRef } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock Angular's createComponent ----------------------------------------
const createComponentSpy = vi.fn();
vi.mock('@angular/core', async () => {
  const actual = await vi.importActual<typeof import('@angular/core')>('@angular/core');
  return {
    ...actual,
    createComponent: (...args: unknown[]) => createComponentSpy(...args),
  };
});

// --- Mock template registries ----------------------------------------------
const viewTemplateGetter = vi.fn();
const editorTemplateGetter = vi.fn();
const structuralViewGetter = vi.fn();
const structuralEditorGetter = vi.fn();
const detailTemplateGetter = vi.fn();
const responsiveCardGetter = vi.fn();
const toolPanelGetter = vi.fn();
const formArrayContextGetter = vi.fn();

vi.mock('./directives/grid-column-view.directive', async () => {
  const actual = await vi.importActual<typeof import('./directives/grid-column-view.directive')>(
    './directives/grid-column-view.directive',
  );
  return { ...actual, getViewTemplate: (el: HTMLElement) => viewTemplateGetter(el) };
});
vi.mock('./directives/grid-column-editor.directive', async () => {
  const actual = await vi.importActual<typeof import('./directives/grid-column-editor.directive')>(
    './directives/grid-column-editor.directive',
  );
  return { ...actual, getEditorTemplate: (el: HTMLElement) => editorTemplateGetter(el) };
});
vi.mock('./directives/structural-directives', async () => {
  const actual = await vi.importActual<typeof import('./directives/structural-directives')>(
    './directives/structural-directives',
  );
  return {
    ...actual,
    getStructuralViewTemplate: (el: HTMLElement) => structuralViewGetter(el),
    getStructuralEditorTemplate: (el: HTMLElement) => structuralEditorGetter(el),
  };
});
vi.mock('./directives/grid-detail-view.directive', async () => {
  const actual = await vi.importActual<typeof import('./directives/grid-detail-view.directive')>(
    './directives/grid-detail-view.directive',
  );
  return { ...actual, getDetailTemplate: (el: HTMLElement) => detailTemplateGetter(el) };
});
vi.mock('./directives/grid-responsive-card.directive', async () => {
  const actual = await vi.importActual<typeof import('./directives/grid-responsive-card.directive')>(
    './directives/grid-responsive-card.directive',
  );
  return { ...actual, getResponsiveCardTemplate: (el: HTMLElement) => responsiveCardGetter(el) };
});
vi.mock('./directives/grid-tool-panel.directive', async () => {
  const actual = await vi.importActual<typeof import('./directives/grid-tool-panel.directive')>(
    './directives/grid-tool-panel.directive',
  );
  return { ...actual, getToolPanelTemplate: (el: HTMLElement) => toolPanelGetter(el) };
});
vi.mock('./directives/grid-form-array.directive', async () => {
  const actual = await vi.importActual<typeof import('./directives/grid-form-array.directive')>(
    './directives/grid-form-array.directive',
  );
  return { ...actual, getFormArrayContext: (el: HTMLElement) => formArrayContextGetter(el) };
});

// Import after mocks so the module under test sees the mocked getters
import type { GridConfig } from './angular-column-config';
import { GridAdapter } from './angular-grid-adapter';
import { GridTypeRegistry } from './grid-type-registry';

/**
 * GridTypeRegistry has an `inject(GRID_TYPE_DEFAULTS)` call in its constructor,
 * so we cannot instantiate it outside an Angular injection context. This stub
 * mirrors its public surface with a plain Map.
 */
function createMockTypeRegistry(): GridTypeRegistry {
  const store = new Map<string, unknown>();
  return {
    register(type: string, config: unknown) {
      store.set(type, config);
    },
    get(type: string) {
      return store.get(type);
    },
  } as unknown as GridTypeRegistry;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockTemplate() {
  return { _isMockTemplate: true } as unknown as Parameters<ViewContainerRef['createEmbeddedView']>[0];
}

interface MockViewRef {
  context: Record<string, unknown>;
  rootNodes: Node[];
  detectChanges: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

function createMockViewRef(rootNode?: Node): MockViewRef {
  const node = rootNode ?? document.createElement('div');
  return {
    context: {},
    rootNodes: [node],
    detectChanges: vi.fn(),
    destroy: vi.fn(),
  };
}

interface MockComponentRef {
  instance: Record<string, unknown>;
  hostView: object;
  location: { nativeElement: HTMLElement };
  changeDetectorRef: { detectChanges: ReturnType<typeof vi.fn> };
  setInput: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

function createMockComponentRef(host: HTMLElement): MockComponentRef {
  return {
    instance: {},
    hostView: {},
    location: { nativeElement: host },
    changeDetectorRef: { detectChanges: vi.fn() },
    setInput: vi.fn(),
    destroy: vi.fn(),
  };
}

/**
 * Default behavior for `createComponent`: read the `hostElement` from the
 * options bag and return a mock ComponentRef whose `location.nativeElement`
 * points at that same element. This matches Angular's actual contract and
 * lets cleanup helpers (`releaseCell`, `unmount`) match the host correctly.
 */
function installDefaultCreateComponent(): { lastRef: () => MockComponentRef | undefined } {
  let last: MockComponentRef | undefined;
  createComponentSpy.mockImplementation((_cls: unknown, opts: { hostElement: HTMLElement }) => {
    last = createMockComponentRef(opts.hostElement);
    return last;
  });
  return { lastRef: () => last };
}

function makeAdapter(opts: { typeRegistry?: GridTypeRegistry | null } = {}) {
  const createEmbeddedView = vi.fn((_template: unknown, ctx: unknown) => {
    const ref = createMockViewRef();
    ref.context = (ctx as Record<string, unknown>) ?? {};
    return ref;
  });
  const injector = {
    get: vi.fn((token: unknown) => {
      if (token === GridTypeRegistry) {
        return opts.typeRegistry === undefined ? null : opts.typeRegistry;
      }
      return null;
    }),
  } as unknown as EnvironmentInjector;
  const appRef = { attachView: vi.fn() } as unknown as ApplicationRef;
  const viewContainerRef = { createEmbeddedView } as unknown as ViewContainerRef;

  const adapter = new GridAdapter(injector, appRef, viewContainerRef);
  return { adapter, createEmbeddedView, injector, appRef, viewContainerRef };
}

// A plain ES6 class is recognized as a component class by `isComponentClass`
// (see angular-column-config.ts). We mock createComponent so the adapter never
// calls real Angular code on it.
class FakeComponent {}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GridAdapter', () => {
  beforeEach(() => {
    viewTemplateGetter.mockReset();
    editorTemplateGetter.mockReset();
    structuralViewGetter.mockReset();
    structuralEditorGetter.mockReset();
    detailTemplateGetter.mockReset();
    responsiveCardGetter.mockReset();
    toolPanelGetter.mockReset();
    formArrayContextGetter.mockReset();
    createComponentSpy.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('construction', () => {
    it('registers itself as the global Angular grid adapter', () => {
      const { adapter } = makeAdapter();
      expect((window as unknown as Record<string, unknown>)['__ANGULAR_GRID_ADAPTER__']).toBe(adapter);
    });

    it('captures the GridTypeRegistry when present', () => {
      const registry = createMockTypeRegistry();
      registry.register('country', { renderer: FakeComponent });
      const { adapter } = makeAdapter({ typeRegistry: registry });
      // No public accessor — proxy via getTypeDefault below
      expect(adapter).toBeDefined();
    });

    it('tolerates a missing GridTypeRegistry without throwing', () => {
      expect(() => makeAdapter({ typeRegistry: null })).not.toThrow();
    });

    it('tolerates injector.get throwing', () => {
      const injector = {
        get: vi.fn(() => {
          throw new Error('no provider');
        }),
      } as unknown as EnvironmentInjector;
      const appRef = { attachView: vi.fn() } as unknown as ApplicationRef;
      const viewContainerRef = { createEmbeddedView: vi.fn() } as unknown as ViewContainerRef;
      expect(() => new GridAdapter(injector, appRef, viewContainerRef)).not.toThrow();
    });
  });

  describe('processGridConfig / processConfig', () => {
    it('returns the config unchanged when nothing needs bridging', () => {
      const { adapter } = makeAdapter();
      const cfg: GridConfig = { columns: [{ field: 'name' }] };
      const result = adapter.processGridConfig(cfg);
      expect(result.columns?.[0]).toMatchObject({ field: 'name' });
    });

    it('processes columns', () => {
      const { adapter } = makeAdapter();
      const cfg: GridConfig = {
        columns: [{ field: 'status', renderer: FakeComponent }],
      };
      const result = adapter.processGridConfig(cfg);
      expect(typeof result.columns?.[0].renderer).toBe('function');
    });

    it('processes typeDefaults', () => {
      const { adapter } = makeAdapter();
      const cfg: GridConfig = {
        typeDefaults: {
          country: { renderer: FakeComponent, editor: FakeComponent, filterPanelRenderer: FakeComponent },
        },
      };
      const result = adapter.processGridConfig(cfg);
      const td = result.typeDefaults?.['country'];
      expect(typeof td?.renderer).toBe('function');
      expect(typeof td?.editor).toBe('function');
      expect(typeof td?.filterPanelRenderer).toBe('function');
    });

    it('passes through type defaults with non-component renderer/editor', () => {
      const { adapter } = makeAdapter();
      const renderer = vi.fn();
      const cfg: GridConfig = {
        typeDefaults: { number: { renderer } },
      };
      const result = adapter.processGridConfig(cfg);
      expect(result.typeDefaults?.['number'].renderer).toBe(renderer);
    });

    it('processes loadingRenderer when it is a component class', () => {
      const { adapter } = makeAdapter();
      const cfg: GridConfig = { loadingRenderer: FakeComponent } as unknown as GridConfig;
      const result = adapter.processGridConfig(cfg);
      expect(typeof (result as { loadingRenderer?: unknown }).loadingRenderer).toBe('function');
    });

    it('leaves non-component loadingRenderer alone', () => {
      const { adapter } = makeAdapter();
      const fn = vi.fn();
      const cfg = { loadingRenderer: fn } as unknown as GridConfig;
      const result = adapter.processGridConfig(cfg);
      expect((result as { loadingRenderer?: unknown }).loadingRenderer).toBe(fn);
    });
  });

  describe('processColumn', () => {
    it('bridges renderer / editor / headerRenderer / headerLabelRenderer component classes', () => {
      const { adapter } = makeAdapter();
      const result = adapter.processColumn({
        field: 'x',
        renderer: FakeComponent,
        editor: FakeComponent,
        headerRenderer: FakeComponent,
        headerLabelRenderer: FakeComponent,
      });
      expect(typeof result.renderer).toBe('function');
      expect(typeof result.editor).toBe('function');
      expect(typeof result.headerRenderer).toBe('function');
      expect(typeof result.headerLabelRenderer).toBe('function');
    });

    it('leaves non-component renderers / editors untouched', () => {
      const { adapter } = makeAdapter();
      const renderer = vi.fn();
      const editor = vi.fn();
      const result = adapter.processColumn({ field: 'x', renderer, editor });
      expect(result.renderer).toBe(renderer);
      expect(result.editor).toBe(editor);
    });
  });

  describe('canHandle', () => {
    it('returns false when no template is registered', () => {
      const { adapter } = makeAdapter();
      structuralViewGetter.mockReturnValue(undefined);
      viewTemplateGetter.mockReturnValue(undefined);
      structuralEditorGetter.mockReturnValue(undefined);
      editorTemplateGetter.mockReturnValue(undefined);
      const el = document.createElement('tbw-grid-column');
      expect(adapter.canHandle(el)).toBe(false);
    });

    it('returns true when a structural view template is registered', () => {
      const { adapter } = makeAdapter();
      structuralViewGetter.mockReturnValue(createMockTemplate());
      const el = document.createElement('tbw-grid-column');
      expect(adapter.canHandle(el)).toBe(true);
    });

    it('returns true when an editor template is registered', () => {
      const { adapter } = makeAdapter();
      structuralEditorGetter.mockReturnValue(undefined);
      editorTemplateGetter.mockReturnValue(createMockTemplate());
      const el = document.createElement('tbw-grid-column');
      expect(adapter.canHandle(el)).toBe(true);
    });
  });

  describe('createRenderer', () => {
    it('returns undefined when no template is registered', () => {
      const { adapter } = makeAdapter();
      structuralViewGetter.mockReturnValue(undefined);
      viewTemplateGetter.mockReturnValue(undefined);
      const el = document.createElement('tbw-grid-column');
      expect(adapter.createRenderer(el)).toBeUndefined();
    });

    it('creates an embedded view, caches per cell, and updates on subsequent calls', () => {
      const { adapter, createEmbeddedView } = makeAdapter();
      structuralViewGetter.mockReturnValue(createMockTemplate());
      const el = document.createElement('tbw-grid-column');
      const renderer = adapter.createRenderer(el);
      expect(renderer).toBeDefined();

      const cellEl = document.createElement('div');
      const out1 = renderer!({ value: 1, row: { id: 1 }, column: {}, cellEl } as never);
      expect(out1).toBeInstanceOf(HTMLElement);
      expect(createEmbeddedView).toHaveBeenCalledTimes(1);

      // Second call for same cell should reuse the cached view
      const out2 = renderer!({ value: 2, row: { id: 1 }, column: {}, cellEl } as never);
      expect(createEmbeddedView).toHaveBeenCalledTimes(1);
      expect(out2).toBe(out1);
    });

    it('skips rendering for cells in editing mode', () => {
      const { adapter, createEmbeddedView } = makeAdapter();
      structuralViewGetter.mockReturnValue(createMockTemplate());
      const renderer = adapter.createRenderer(document.createElement('tbw-grid-column'));
      const cellEl = document.createElement('div');
      cellEl.classList.add('editing');
      expect(renderer!({ value: 1, row: {}, column: {}, cellEl } as never)).toBeNull();
      expect(createEmbeddedView).not.toHaveBeenCalled();
    });

    it('handles cells without a cellEl reference', () => {
      const { adapter } = makeAdapter();
      structuralViewGetter.mockReturnValue(createMockTemplate());
      const renderer = adapter.createRenderer(document.createElement('tbw-grid-column'));
      const result = renderer!({ value: 1, row: {}, column: {} } as never);
      expect(result).toBeInstanceOf(HTMLElement);
    });
  });

  describe('createEditor', () => {
    it('returns undefined when no editor template is registered', () => {
      const { adapter } = makeAdapter();
      structuralEditorGetter.mockReturnValue(undefined);
      editorTemplateGetter.mockReturnValue(undefined);
      const el = document.createElement('tbw-grid-column');
      expect(adapter.createEditor(el)).toBeUndefined();
    });

    it('creates an embedded view and wires commit/cancel auto-events', () => {
      const { adapter } = makeAdapter();
      structuralEditorGetter.mockReturnValue(createMockTemplate());

      const grid = document.createElement('tbw-grid');
      const col = document.createElement('tbw-grid-column');
      grid.appendChild(col);
      document.body.appendChild(grid);

      const editor = adapter.createEditor(col);
      expect(editor).toBeDefined();

      const commit = vi.fn();
      const cancel = vi.fn();
      const container = editor!({ value: 'hi', row: {}, field: 'name', column: {}, commit, cancel } as never);
      expect(container).toBeInstanceOf(HTMLElement);

      container!.dispatchEvent(new CustomEvent('commit', { detail: 'bye', bubbles: true }));
      expect(commit).toHaveBeenCalledWith('bye');

      container!.dispatchEvent(new CustomEvent('cancel', { bubbles: true }));
      expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('uses a FormArray FormControl when one is available', () => {
      const { adapter } = makeAdapter();
      structuralEditorGetter.mockReturnValue(createMockTemplate());
      const getControl = vi.fn(() => 'mock-control');
      formArrayContextGetter.mockReturnValue({ hasFormGroups: true, getControl });

      const grid = document.createElement('tbw-grid');
      const col = document.createElement('tbw-grid-column');
      grid.appendChild(col);
      (grid as unknown as { rows: unknown[] }).rows = [{ id: 1 }];
      document.body.appendChild(grid);

      const editor = adapter.createEditor(col);
      const row = (grid as unknown as { rows: unknown[] }).rows[0];
      editor!({ value: 'v', row, field: 'name', column: {}, commit: vi.fn(), cancel: vi.fn() } as never);
      expect(getControl).toHaveBeenCalledWith(0, 'name');
    });

    it('invokes onValueChange callback to push external updates into the view', () => {
      const { adapter } = makeAdapter();
      structuralEditorGetter.mockReturnValue(createMockTemplate());

      const grid = document.createElement('tbw-grid');
      const col = document.createElement('tbw-grid-column');
      grid.appendChild(col);
      document.body.appendChild(grid);

      const editor = adapter.createEditor(col);
      const onValueChange = vi.fn();
      editor!({
        value: 'old',
        row: {},
        field: 'x',
        column: {},
        commit: vi.fn(),
        cancel: vi.fn(),
        onValueChange,
      } as never);
      expect(onValueChange).toHaveBeenCalledOnce();
      const cb = onValueChange.mock.calls[0][0] as (v: unknown) => void;
      expect(() => cb('new')).not.toThrow();
    });
  });

  describe('createDetailRenderer / parseDetailElement', () => {
    it('createDetailRenderer returns undefined when no template is registered', () => {
      const { adapter } = makeAdapter();
      detailTemplateGetter.mockReturnValue(undefined);
      expect(adapter.createDetailRenderer(document.createElement('tbw-grid'))).toBeUndefined();
    });

    it('createDetailRenderer creates a container with the embedded view rootNodes', () => {
      const { adapter } = makeAdapter();
      detailTemplateGetter.mockReturnValue(createMockTemplate());
      const fn = adapter.createDetailRenderer(document.createElement('tbw-grid'));
      const container = fn!({ id: 1 });
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.children.length).toBe(1);
    });

    it('parseDetailElement returns undefined when no template is registered', () => {
      const { adapter } = makeAdapter();
      detailTemplateGetter.mockReturnValue(undefined);
      const grid = document.createElement('tbw-grid');
      const detail = document.createElement('tbw-grid-detail');
      grid.appendChild(detail);
      expect(adapter.parseDetailElement(detail)).toBeUndefined();
    });

    it('parseDetailElement returns a renderer when template is present', () => {
      const { adapter } = makeAdapter();
      detailTemplateGetter.mockReturnValue(createMockTemplate());
      const grid = document.createElement('tbw-grid');
      const detail = document.createElement('tbw-grid-detail');
      grid.appendChild(detail);
      const renderer = adapter.parseDetailElement(detail);
      expect(typeof renderer).toBe('function');
      expect(renderer!({ id: 1 } as unknown as never, 0)).toBeInstanceOf(HTMLElement);
    });
  });

  describe('createResponsiveCardRenderer / parseResponsiveCardElement', () => {
    it('returns undefined when no card template is registered', () => {
      const { adapter } = makeAdapter();
      responsiveCardGetter.mockReturnValue(undefined);
      expect(adapter.createResponsiveCardRenderer(document.createElement('tbw-grid'))).toBeUndefined();
    });

    it('creates a card renderer that returns a container element', () => {
      const { adapter } = makeAdapter();
      responsiveCardGetter.mockReturnValue(createMockTemplate());
      const r = adapter.createResponsiveCardRenderer(document.createElement('tbw-grid'));
      expect(r!({ id: 1 }, 0)).toBeInstanceOf(HTMLElement);
    });

    it('parseResponsiveCardElement returns undefined without a parent grid', () => {
      const { adapter } = makeAdapter();
      const card = document.createElement('tbw-grid-responsive-card');
      expect(adapter.parseResponsiveCardElement(card)).toBeUndefined();
    });

    it('parseResponsiveCardElement delegates to createResponsiveCardRenderer', () => {
      const { adapter } = makeAdapter();
      responsiveCardGetter.mockReturnValue(createMockTemplate());
      const grid = document.createElement('tbw-grid');
      const card = document.createElement('tbw-grid-responsive-card');
      grid.appendChild(card);
      expect(typeof adapter.parseResponsiveCardElement(card)).toBe('function');
    });
  });

  describe('createToolPanelRenderer', () => {
    it('returns undefined when no panel template is registered', () => {
      const { adapter } = makeAdapter();
      toolPanelGetter.mockReturnValue(undefined);
      expect(adapter.createToolPanelRenderer(document.createElement('tbw-grid-tool-panel'))).toBeUndefined();
    });

    it('returns a renderer that mounts into the container and exposes a cleanup', () => {
      const { adapter } = makeAdapter();
      toolPanelGetter.mockReturnValue(createMockTemplate());
      const grid = document.createElement('tbw-grid');
      const panelEl = document.createElement('tbw-grid-tool-panel');
      grid.appendChild(panelEl);

      const renderer = adapter.createToolPanelRenderer(panelEl);
      const container = document.createElement('div');
      const cleanup = renderer!(container);
      expect(container.children.length).toBe(1);
      expect(typeof cleanup).toBe('function');
      (cleanup as () => void)();
    });
  });

  describe('getTypeDefault', () => {
    it('returns undefined when no registry is available', () => {
      const { adapter } = makeAdapter({ typeRegistry: null });
      expect(adapter.getTypeDefault('country')).toBeUndefined();
    });

    it('returns undefined for unknown types', () => {
      const registry = createMockTypeRegistry();
      const { adapter } = makeAdapter({ typeRegistry: registry });
      expect(adapter.getTypeDefault('country')).toBeUndefined();
    });

    it('bridges renderer / editor / filterPanelRenderer component classes', () => {
      const registry = createMockTypeRegistry();
      registry.register('country', {
        renderer: FakeComponent,
        editor: FakeComponent,
        filterPanelRenderer: FakeComponent,
        editorParams: { foo: 'bar' },
      });
      const { adapter } = makeAdapter({ typeRegistry: registry });
      const td = adapter.getTypeDefault('country');
      expect(typeof td?.renderer).toBe('function');
      expect(typeof td?.editor).toBe('function');
      expect(typeof td?.filterPanelRenderer).toBe('function');
      expect(td?.editorParams).toEqual({ foo: 'bar' });
    });

    it('preserves a non-component filterPanelRenderer', () => {
      const registry = createMockTypeRegistry();
      const fn = vi.fn();
      registry.register('country', { filterPanelRenderer: fn as never });
      const { adapter } = makeAdapter({ typeRegistry: registry });
      const td = adapter.getTypeDefault('country');
      expect(td?.filterPanelRenderer).toBe(fn);
    });
  });

  describe('processGroupingColumnsConfig / processGroupingRowsConfig / processPinnedRowsConfig', () => {
    it('processGroupingColumnsConfig converts component classes', () => {
      const { adapter } = makeAdapter();
      const result = adapter.processGroupingColumnsConfig({
        groupHeaderRenderer: FakeComponent,
        columnGroups: [{ id: 'g', columns: ['a'], renderer: FakeComponent }],
      } as never);
      expect(typeof (result as { groupHeaderRenderer?: unknown }).groupHeaderRenderer).toBe('function');
      expect(typeof (result as { columnGroups: { renderer: unknown }[] }).columnGroups[0].renderer).toBe('function');
    });

    it('processGroupingColumnsConfig is a no-op when no bridging is needed', () => {
      const { adapter } = makeAdapter();
      const cfg = { columnGroups: [{ id: 'g', columns: ['a'] }] } as never;
      expect(adapter.processGroupingColumnsConfig(cfg)).toBe(cfg);
    });

    it('processGroupingRowsConfig converts groupRowRenderer', () => {
      const { adapter } = makeAdapter();
      const result = adapter.processGroupingRowsConfig({ groupRowRenderer: FakeComponent } as never);
      expect(typeof (result as { groupRowRenderer?: unknown }).groupRowRenderer).toBe('function');
    });

    it('processGroupingRowsConfig is a no-op when no bridging is needed', () => {
      const { adapter } = makeAdapter();
      const cfg = {} as never;
      expect(adapter.processGroupingRowsConfig(cfg)).toBe(cfg);
    });

    it('processPinnedRowsConfig converts component renderers in customPanels', () => {
      const { adapter } = makeAdapter();
      const result = adapter.processPinnedRowsConfig({
        customPanels: [
          { id: 'a', position: 'top', render: FakeComponent },
          { id: 'b', position: 'bottom', render: vi.fn() },
        ],
      } as never);
      const panels = (result as { customPanels: { render: unknown }[] }).customPanels;
      expect(typeof panels[0].render).toBe('function');
      expect(typeof panels[1].render).toBe('function');
    });

    it('processPinnedRowsConfig is a no-op without customPanels', () => {
      const { adapter } = makeAdapter();
      const cfg = {} as never;
      expect(adapter.processPinnedRowsConfig(cfg)).toBe(cfg);
    });

    it('processPinnedRowsConfig is a no-op when no panel needs bridging', () => {
      const { adapter } = makeAdapter();
      const cfg = { customPanels: [{ id: 'a', position: 'top', render: vi.fn() }] } as never;
      expect(adapter.processPinnedRowsConfig(cfg)).toBe(cfg);
    });
  });

  describe('mountComponent (via createComponentRenderer / createComponentEditor)', () => {
    it('createComponentRenderer mounts and caches per cell', () => {
      const { adapter, appRef } = makeAdapter();
      const componentRef = createMockComponentRef(document.createElement('span'));
      createComponentSpy.mockReturnValue(componentRef);

      const cfg: GridConfig = { columns: [{ field: 'status', renderer: FakeComponent }] };
      const result = adapter.processGridConfig(cfg);
      const renderer = result.columns![0].renderer as (ctx: unknown) => HTMLElement;

      const cellEl = document.createElement('div');
      const host1 = renderer({ value: 'a', row: { id: 1 }, column: {}, cellEl });
      expect(host1).toBeInstanceOf(HTMLElement);
      expect(createComponentSpy).toHaveBeenCalledTimes(1);
      expect(appRef.attachView).toHaveBeenCalledTimes(1);

      // Second call for same cellEl reuses the cached component
      const host2 = renderer({ value: 'b', row: { id: 1 }, column: {}, cellEl });
      expect(host2).toBe(host1);
      expect(createComponentSpy).toHaveBeenCalledTimes(1);
      expect(componentRef.setInput).toHaveBeenCalledWith('value', 'b');
    });

    it('createComponentRenderer mounts without a cellEl (no caching)', () => {
      const { adapter } = makeAdapter();
      createComponentSpy.mockImplementation(() => createMockComponentRef(document.createElement('span')));

      const cfg: GridConfig = { columns: [{ field: 'status', renderer: FakeComponent }] };
      const result = adapter.processGridConfig(cfg);
      const renderer = result.columns![0].renderer as (ctx: unknown) => HTMLElement;

      renderer({ value: 'a', row: {}, column: {} });
      renderer({ value: 'b', row: {}, column: {} });
      expect(createComponentSpy).toHaveBeenCalledTimes(2);
    });

    it('createComponentEditor wires commit/cancel and onValueChange', () => {
      const { adapter } = makeAdapter();
      const componentRef = createMockComponentRef(document.createElement('span'));
      const onExternalValueChange = vi.fn();
      componentRef.instance['onExternalValueChange'] = onExternalValueChange;
      createComponentSpy.mockReturnValue(componentRef);

      const result = adapter.processColumn({ field: 'x', editor: FakeComponent });
      const editor = result.editor as (ctx: unknown) => HTMLElement;

      const commit = vi.fn();
      const cancel = vi.fn();
      const onValueChange = vi.fn();
      const host = editor({
        value: 'a',
        row: {},
        column: {},
        field: 'x',
        commit,
        cancel,
        onValueChange,
      });
      expect(host).toBeInstanceOf(HTMLElement);
      expect(onValueChange).toHaveBeenCalledOnce();

      // Trigger the external value change callback
      const externalCb = onValueChange.mock.calls[0][0] as (v: unknown) => void;
      externalCb('updated');
      expect(onExternalValueChange).toHaveBeenCalledWith('updated');
      expect(componentRef.setInput).toHaveBeenCalledWith('value', 'updated');
    });

    it('setComponentInputs swallows setInput errors silently', () => {
      const { adapter } = makeAdapter();
      const componentRef = createMockComponentRef(document.createElement('span'));
      componentRef.setInput.mockImplementation(() => {
        throw new Error('no such input');
      });
      createComponentSpy.mockReturnValue(componentRef);

      const result = adapter.processColumn({ field: 'x', renderer: FakeComponent });
      const renderer = result.renderer as (ctx: unknown) => HTMLElement;
      expect(() => renderer({ value: 'a', row: {}, column: {} })).not.toThrow();
    });

    it('header / headerLabel / loadingRenderer / pinned / grouping renderers all return host elements', () => {
      const { adapter, appRef } = makeAdapter();
      createComponentSpy.mockImplementation(() => createMockComponentRef(document.createElement('span')));

      // Header renderer
      const col = adapter.processColumn({
        field: 'x',
        headerRenderer: FakeComponent,
        headerLabelRenderer: FakeComponent,
      });
      const headerEl = (col.headerRenderer as (ctx: unknown) => HTMLElement)({
        column: { field: 'x' },
        value: 'X',
      });
      expect(headerEl).toBeInstanceOf(HTMLElement);
      const labelEl = (col.headerLabelRenderer as (ctx: unknown) => HTMLElement)({
        column: { field: 'x' },
        value: 'X',
      });
      expect(labelEl).toBeInstanceOf(HTMLElement);

      // Loading renderer
      const cfg = adapter.processGridConfig({ loadingRenderer: FakeComponent } as unknown as GridConfig);
      const loaderEl = (cfg as { loadingRenderer: (ctx: unknown) => HTMLElement }).loadingRenderer({
        size: 'small',
      });
      expect(loaderEl).toBeInstanceOf(HTMLElement);

      // Grouping columns
      const gc = adapter.processGroupingColumnsConfig({
        groupHeaderRenderer: FakeComponent,
        columnGroups: [{ id: 'g', columns: ['x'], renderer: FakeComponent }],
      } as never);
      const groupHeaderEl = (gc as { groupHeaderRenderer: (p: unknown) => HTMLElement }).groupHeaderRenderer({
        id: 'g',
        label: 'G',
        columns: [],
        firstIndex: 0,
        isImplicit: false,
      });
      expect(groupHeaderEl).toBeInstanceOf(HTMLElement);

      // Grouping rows
      const gr = adapter.processGroupingRowsConfig({ groupRowRenderer: FakeComponent } as never);
      const groupRowEl = (gr as { groupRowRenderer: (p: unknown) => HTMLElement }).groupRowRenderer({
        key: 'k',
        value: 'v',
        depth: 0,
        rows: [],
        expanded: true,
        toggleExpand: vi.fn(),
      });
      expect(groupRowEl).toBeInstanceOf(HTMLElement);

      // Pinned rows
      const pr = adapter.processPinnedRowsConfig({
        customPanels: [{ id: 'p', position: 'top', render: FakeComponent }],
      } as never);
      const panelEl = (pr as { customPanels: { render: (c: unknown) => HTMLElement }[] }).customPanels[0].render({
        totalRows: 0,
        filteredRows: 0,
        selectedRows: 0,
        columns: [],
        rows: [],
        grid: {},
      });
      expect(panelEl).toBeInstanceOf(HTMLElement);

      // Filter panel
      const td = adapter.processTypeDefaults({ x: { filterPanelRenderer: FakeComponent } });
      const container = document.createElement('div');
      (td['x'].filterPanelRenderer as (c: HTMLElement, p: unknown) => void)(container, { foo: 'bar' });
      expect(container.children.length).toBe(1);

      expect(appRef.attachView).toHaveBeenCalled();
    });

    it('filter panel renderer ignores setInput errors', () => {
      const { adapter } = makeAdapter();
      const componentRef = createMockComponentRef(document.createElement('span'));
      componentRef.setInput.mockImplementation(() => {
        throw new Error('no input');
      });
      createComponentSpy.mockReturnValue(componentRef);

      const td = adapter.processTypeDefaults({ x: { filterPanelRenderer: FakeComponent } });
      const container = document.createElement('div');
      expect(() => (td['x'].filterPanelRenderer as (c: HTMLElement, p: unknown) => void)(container, {})).not.toThrow();
    });
  });

  describe('releaseCell / unmount / destroy', () => {
    it('releaseCell destroys editor view refs whose root is inside the cell', () => {
      const { adapter } = makeAdapter();
      structuralEditorGetter.mockReturnValue(createMockTemplate());

      const grid = document.createElement('tbw-grid');
      const col = document.createElement('tbw-grid-column');
      grid.appendChild(col);
      document.body.appendChild(grid);

      const cellEl = document.createElement('div');
      const editor = adapter.createEditor(col)!;
      const host = editor({ value: 'v', row: {}, field: 'x', column: {}, commit: vi.fn(), cancel: vi.fn() } as never);
      cellEl.appendChild(host as Node);

      // Smoke: should not throw, and a subsequent call should still work
      expect(() => adapter.releaseCell(cellEl)).not.toThrow();
      expect(() => adapter.releaseCell(cellEl)).not.toThrow();
    });

    it('releaseCell destroys editor component refs inside the cell', () => {
      const { adapter } = makeAdapter();
      const tracker = installDefaultCreateComponent();

      const result = adapter.processColumn({ field: 'x', editor: FakeComponent });
      const editor = result.editor as (ctx: unknown) => HTMLElement;
      const created = editor({ value: 'v', row: {}, column: {}, field: 'x', commit: vi.fn(), cancel: vi.fn() });

      const cellEl = document.createElement('div');
      cellEl.appendChild(created);
      adapter.releaseCell(cellEl);
      expect(tracker.lastRef()!.destroy).toHaveBeenCalled();
    });

    it('unmount destroys the matching tool panel view', () => {
      const { adapter } = makeAdapter();
      toolPanelGetter.mockReturnValue(createMockTemplate());
      const grid = document.createElement('tbw-grid');
      const panelEl = document.createElement('tbw-grid-tool-panel');
      grid.appendChild(panelEl);

      const renderer = adapter.createToolPanelRenderer(panelEl)!;
      const container = document.createElement('div');
      renderer(container);

      adapter.unmount(container);
      // Subsequent unmount on an empty adapter shouldn't throw
      expect(() => adapter.unmount(container)).not.toThrow();
    });

    it('unmount destroys component refs inside the container', () => {
      const { adapter } = makeAdapter();
      const tracker = installDefaultCreateComponent();
      const cfg = adapter.processGridConfig({ loadingRenderer: FakeComponent } as unknown as GridConfig);
      const el = (cfg as { loadingRenderer: (ctx: unknown) => HTMLElement }).loadingRenderer({ size: 'small' });

      const container = document.createElement('div');
      container.appendChild(el);
      adapter.unmount(container);
      expect(tracker.lastRef()!.destroy).toHaveBeenCalled();
    });

    it('destroy releases all tracked view and component refs', () => {
      const { adapter } = makeAdapter();
      const tracker = installDefaultCreateComponent();

      // Renderer (component path) — tracked in componentRefs
      const col = adapter.processColumn({ field: 'x', renderer: FakeComponent });
      (col.renderer as (ctx: unknown) => HTMLElement)({ value: 1, row: {}, column: {} });

      // Editor (component path) — tracked in editorComponentRefs
      const col2 = adapter.processColumn({ field: 'x', editor: FakeComponent });
      (col2.editor as (ctx: unknown) => HTMLElement)({
        value: 1,
        row: {},
        column: {},
        field: 'x',
        commit: vi.fn(),
        cancel: vi.fn(),
      });

      // Renderer (template path) — tracked in viewRefs
      structuralViewGetter.mockReturnValue(createMockTemplate());
      const renderer = adapter.createRenderer(document.createElement('tbw-grid-column'))!;
      renderer({ value: 1, row: {}, column: {}, cellEl: document.createElement('div') } as never);

      // Editor (template path) — tracked in editorViewRefs
      structuralEditorGetter.mockReturnValue(createMockTemplate());
      const grid = document.createElement('tbw-grid');
      const colEl = document.createElement('tbw-grid-column');
      grid.appendChild(colEl);
      document.body.appendChild(grid);
      const editor = adapter.createEditor(colEl)!;
      editor({ value: 'v', row: {}, field: 'x', column: {}, commit: vi.fn(), cancel: vi.fn() } as never);

      adapter.destroy();
      expect(tracker.lastRef()!.destroy).toHaveBeenCalled();
    });
  });

  describe('before-edit-close blur bridge', () => {
    it('flushes the focused input on before-edit-close (template/createEditor path)', async () => {
      const { adapter } = makeAdapter();
      structuralEditorGetter.mockReturnValue(createMockTemplate());

      const grid = document.createElement('tbw-grid');
      const col = document.createElement('tbw-grid-column');
      grid.appendChild(col);
      const cell = document.createElement('div');
      grid.appendChild(cell);
      document.body.appendChild(grid);

      const editor = adapter.createEditor(col)!;
      const host = editor({ value: 'v', row: {}, field: 'x', column: {}, commit: vi.fn(), cancel: vi.fn() } as never);
      cell.appendChild(host);

      const input = document.createElement('input');
      host.appendChild(input);
      input.focus();
      expect(document.activeElement).toBe(input);

      // Wait one microtask so attachBeforeEditCloseFlush resolves the grid.
      await Promise.resolve();

      const blurSpy = vi.fn();
      input.addEventListener('blur', blurSpy);
      grid.dispatchEvent(new CustomEvent('before-edit-close'));
      expect(blurSpy).toHaveBeenCalledTimes(1);
      expect(document.activeElement).not.toBe(input);
    });

    it('flushes the focused input on before-edit-close (component/createComponentEditor path)', async () => {
      const { adapter } = makeAdapter();
      installDefaultCreateComponent();

      const grid = document.createElement('tbw-grid');
      const cell = document.createElement('div');
      grid.appendChild(cell);
      document.body.appendChild(grid);

      const result = adapter.processColumn({ field: 'x', editor: FakeComponent });
      const editor = result.editor as (ctx: unknown) => HTMLElement;
      const host = editor({ value: 'v', row: {}, column: {}, field: 'x', commit: vi.fn(), cancel: vi.fn() });
      cell.appendChild(host);

      const input = document.createElement('input');
      host.appendChild(input);
      input.focus();
      expect(document.activeElement).toBe(input);

      await Promise.resolve();

      const blurSpy = vi.fn();
      input.addEventListener('blur', blurSpy);
      grid.dispatchEvent(new CustomEvent('before-edit-close'));
      expect(blurSpy).toHaveBeenCalledTimes(1);
    });

    it('releaseCell removes the before-edit-close listener (no flush after release)', async () => {
      const { adapter } = makeAdapter();
      installDefaultCreateComponent();

      const grid = document.createElement('tbw-grid');
      const cell = document.createElement('div');
      grid.appendChild(cell);
      document.body.appendChild(grid);

      const result = adapter.processColumn({ field: 'x', editor: FakeComponent });
      const editor = result.editor as (ctx: unknown) => HTMLElement;
      const host = editor({ value: 'v', row: {}, column: {}, field: 'x', commit: vi.fn(), cancel: vi.fn() });
      cell.appendChild(host);

      const input = document.createElement('input');
      host.appendChild(input);
      input.focus();
      await Promise.resolve();

      adapter.releaseCell(cell);

      // Re-focus the (now-detached) input and dispatch — the listener should be gone.
      const blurSpy = vi.fn();
      input.addEventListener('blur', blurSpy);
      input.focus();
      grid.dispatchEvent(new CustomEvent('before-edit-close'));
      expect(blurSpy).not.toHaveBeenCalled();
    });
  });
});
