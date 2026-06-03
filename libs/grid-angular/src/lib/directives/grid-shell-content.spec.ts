/**
 * Behavior tests for GridHeaderContent and GridToolbarContent directives.
 *
 * Follows the package convention established by `grid-form-array.directive.spec.ts`:
 * mock Angular's DI primitives (`inject`, `effect`, `afterNextRender`, `input`,
 * `contentChild`) so we can instantiate the real directive class directly and
 * exercise its registration/unregistration contract against a fake grid.
 *
 * @vitest-environment happy-dom
 */
import '@angular/compiler';
import type { HeaderContentDefinition, ToolbarContentDefinition } from '@toolbox-web/grid';
import { afterEach, describe, expect, it, vi } from 'vitest';

// --- Mock Angular DI primitives --------------------------------------------
let mockInjectResolver: (token: unknown) => unknown = () => undefined;
const afterNextRenderCallbacks: Array<() => void> = [];
const effectCallbacks: Array<() => void> = [];
let destroyCallback: (() => void) | null = null;

vi.mock('@angular/core', async () => {
  const actual = await vi.importActual<typeof import('@angular/core')>('@angular/core');
  function inputFn(initial?: unknown): { (): unknown } & { __setValue: (v: unknown) => void } {
    let value: unknown = initial;
    const fn = (() => value) as { (): unknown } & { __setValue: (v: unknown) => void };
    fn.__setValue = (v: unknown) => {
      value = v;
    };
    return fn;
  }
  const input = Object.assign(inputFn, { required: () => inputFn() });
  return {
    ...actual,
    inject: (token: unknown) => mockInjectResolver(token),
    effect: (cb: () => void) => {
      effectCallbacks.push(cb);
      // Run once immediately (Angular effects run synchronously after construction).
      cb();
      return { destroy: () => undefined };
    },
    afterNextRender: (cb: () => void) => {
      afterNextRenderCallbacks.push(cb);
    },
    input,
    contentChild: inputFn,
  };
});

// Imports must come AFTER vi.mock above.
import { DestroyRef, ElementRef, TemplateRef, ViewContainerRef, type EmbeddedViewRef } from '@angular/core';
import { GridHeaderContent } from './grid-header-content.directive';
import { GridToolbarContent } from './grid-toolbar-content.directive';

// ---------------------------------------------------------------------------
// Harness helpers
// ---------------------------------------------------------------------------

interface MockGrid extends HTMLElement {
  ready: ReturnType<typeof vi.fn>;
  registerHeaderContent: ReturnType<typeof vi.fn>;
  unregisterHeaderContent: ReturnType<typeof vi.fn>;
  registerToolbarContent: ReturnType<typeof vi.fn>;
  unregisterToolbarContent: ReturnType<typeof vi.fn>;
  headerDefs: HeaderContentDefinition[];
  toolbarDefs: ToolbarContentDefinition[];
}

function createMockGrid(): MockGrid {
  const grid = document.createElement('tbw-grid') as unknown as MockGrid;
  grid.headerDefs = [];
  grid.toolbarDefs = [];
  grid.ready = vi.fn(() => Promise.resolve());
  grid.registerHeaderContent = vi.fn((def: HeaderContentDefinition) => {
    grid.headerDefs.push(def);
  });
  grid.unregisterHeaderContent = vi.fn();
  grid.registerToolbarContent = vi.fn((def: ToolbarContentDefinition) => {
    grid.toolbarDefs.push(def);
  });
  grid.unregisterToolbarContent = vi.fn();
  return grid;
}

function createMockViewContainerRef(): ViewContainerRef {
  return {
    createEmbeddedView: vi.fn(<T>(_tpl: TemplateRef<T>, ctx: T) => {
      const node = document.createElement('span');
      node.textContent = 'tpl';
      const view: Partial<EmbeddedViewRef<T>> = {
        rootNodes: [node],
        context: ctx,
        detectChanges: vi.fn(),
        destroy: vi.fn(),
      };
      return view as EmbeddedViewRef<T>;
    }),
  } as unknown as ViewContainerRef;
}

interface BuiltHeader {
  directive: GridHeaderContent;
  grid: MockGrid;
  host: HTMLElement;
  runAfterNextRender: () => Promise<void>;
  triggerDestroy: () => void;
}

function buildHeader(opts: { withGrid?: boolean; id?: string; order?: number } = {}): BuiltHeader {
  afterNextRenderCallbacks.length = 0;
  effectCallbacks.length = 0;
  destroyCallback = null;
  const grid = createMockGrid();
  const host = document.createElement('tbw-grid-header-content');
  if (opts.withGrid !== false) {
    grid.appendChild(host);
    document.body.appendChild(grid);
  } else {
    document.body.appendChild(host);
  }
  const elementRef = { nativeElement: host } as ElementRef<HTMLElement>;
  const viewContainerRef = createMockViewContainerRef();
  const destroyRef = {
    onDestroy: (cb: () => void) => {
      destroyCallback = cb;
      return () => undefined;
    },
  } as unknown as DestroyRef;
  mockInjectResolver = (token: unknown) => {
    if (token === ElementRef) return elementRef;
    if (token === ViewContainerRef) return viewContainerRef;
    if (token === DestroyRef) return destroyRef;
    return undefined;
  };
  const directive = new GridHeaderContent();
  if (opts.id !== undefined) {
    (directive.id as unknown as { __setValue: (v: unknown) => void }).__setValue(opts.id);
  }
  if (opts.order !== undefined) {
    (directive.order as unknown as { __setValue: (v: unknown) => void }).__setValue(opts.order);
  }
  const template = {} as TemplateRef<unknown>;
  (directive.template as unknown as { __setValue: (v: unknown) => void }).__setValue(template);
  return {
    directive,
    grid,
    host,
    runAfterNextRender: async () => {
      const cbs = afterNextRenderCallbacks.splice(0);
      for (const cb of cbs) cb();
      await Promise.resolve();
      await Promise.resolve();
    },
    triggerDestroy: () => destroyCallback?.(),
  };
}

interface BuiltToolbar {
  directive: GridToolbarContent;
  grid: MockGrid;
  host: HTMLElement;
  runAfterNextRender: () => Promise<void>;
  triggerDestroy: () => void;
}

function buildToolbar(opts: { id?: string; order?: number } = {}): BuiltToolbar {
  afterNextRenderCallbacks.length = 0;
  effectCallbacks.length = 0;
  destroyCallback = null;
  const grid = createMockGrid();
  const host = document.createElement('tbw-grid-toolbar-content');
  grid.appendChild(host);
  document.body.appendChild(grid);
  const elementRef = { nativeElement: host } as ElementRef<HTMLElement>;
  const viewContainerRef = createMockViewContainerRef();
  const destroyRef = {
    onDestroy: (cb: () => void) => {
      destroyCallback = cb;
      return () => undefined;
    },
  } as unknown as DestroyRef;
  mockInjectResolver = (token: unknown) => {
    if (token === ElementRef) return elementRef;
    if (token === ViewContainerRef) return viewContainerRef;
    if (token === DestroyRef) return destroyRef;
    return undefined;
  };
  const directive = new GridToolbarContent();
  if (opts.id !== undefined) {
    (directive.id as unknown as { __setValue: (v: unknown) => void }).__setValue(opts.id);
  }
  if (opts.order !== undefined) {
    (directive.order as unknown as { __setValue: (v: unknown) => void }).__setValue(opts.order);
  }
  const template = {} as TemplateRef<unknown>;
  (directive.template as unknown as { __setValue: (v: unknown) => void }).__setValue(template);
  return {
    directive,
    grid,
    host,
    runAfterNextRender: async () => {
      const cbs = afterNextRenderCallbacks.splice(0);
      for (const cb of cbs) cb();
      await Promise.resolve();
      await Promise.resolve();
    },
    triggerDestroy: () => destroyCallback?.(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function runEffects(): void {
  for (const cb of effectCallbacks) cb();
}

afterEach(() => {
  document.body.innerHTML = '';
  afterNextRenderCallbacks.length = 0;
  effectCallbacks.length = 0;
  destroyCallback = null;
});

describe('GridHeaderContent (real directive)', () => {
  it('static ngTemplateContextGuard returns true', () => {
    expect(GridHeaderContent.ngTemplateContextGuard({} as GridHeaderContent, {})).toBe(true);
  });

  it('awaits grid.ready then calls registerHeaderContent with id + order', async () => {
    const built = buildHeader({ id: 'hdr-1', order: 7 });
    await built.runAfterNextRender();
    expect(built.grid.ready).toHaveBeenCalled();
    expect(built.grid.registerHeaderContent).toHaveBeenCalledTimes(1);
    expect(built.grid.headerDefs[0].id).toBe('hdr-1');
    expect(built.grid.headerDefs[0].order).toBe(7);
  });

  it('falls back to a generated id when none is provided', async () => {
    const built = buildHeader({ order: 0 });
    await built.runAfterNextRender();
    expect(built.grid.headerDefs[0].id).toMatch(/^tbw-header-content-\d+$/);
  });

  it('does nothing when no parent <tbw-grid> is in the DOM', async () => {
    const built = buildHeader({ withGrid: false, id: 'no-parent' });
    await built.runAfterNextRender();
    expect(built.grid.registerHeaderContent).not.toHaveBeenCalled();
  });

  it('skips registration if destroyed before ready() resolves', async () => {
    const built = buildHeader({ id: 'hdr-race' });
    let resolveReady: () => void = () => undefined;
    built.grid.ready.mockReturnValue(
      new Promise<void>((res) => {
        resolveReady = res;
      }),
    );
    const cbs = afterNextRenderCallbacks.splice(0);
    for (const cb of cbs) cb();
    built.triggerDestroy();
    resolveReady();
    await Promise.resolve();
    await Promise.resolve();
    expect(built.grid.registerHeaderContent).not.toHaveBeenCalled();
  });

  it('render callback is idempotent for sticky-container reuse', async () => {
    const built = buildHeader({ id: 'hdr-idem' });
    await built.runAfterNextRender();
    const def = built.grid.headerDefs[0];
    const container = document.createElement('div');
    def.render(container);
    expect(container.children.length).toBe(1);
    // Re-render with SAME container — must NOT duplicate.
    def.render(container);
    expect(container.children.length).toBe(1);
  });

  it('unregister is called on directive destroy', async () => {
    const built = buildHeader({ id: 'hdr-destroy' });
    await built.runAfterNextRender();
    built.triggerDestroy();
    expect(built.grid.unregisterHeaderContent).toHaveBeenCalledWith('hdr-destroy');
  });

  it('re-registers when id changes after initial registration', async () => {
    const built = buildHeader({ id: 'hdr-a', order: 1 });
    await built.runAfterNextRender();
    expect(built.grid.headerDefs.map((d) => d.id)).toEqual(['hdr-a']);
    (built.directive.id as unknown as { __setValue: (v: unknown) => void }).__setValue('hdr-b');
    runEffects();
    await Promise.resolve();
    await Promise.resolve();
    expect(built.grid.unregisterHeaderContent).toHaveBeenCalledWith('hdr-a');
    expect(built.grid.headerDefs.map((d) => d.id)).toEqual(['hdr-a', 'hdr-b']);
  });

  it('re-registers when order changes after initial registration', async () => {
    const built = buildHeader({ id: 'hdr-ord', order: 1 });
    await built.runAfterNextRender();
    (built.directive.order as unknown as { __setValue: (v: unknown) => void }).__setValue(9);
    runEffects();
    await Promise.resolve();
    await Promise.resolve();
    expect(built.grid.unregisterHeaderContent).toHaveBeenCalledWith('hdr-ord');
    expect(built.grid.headerDefs.map((d) => d.order)).toEqual([1, 9]);
  });

  it('skips registration when grid.ready() rejects', async () => {
    const built = buildHeader({ id: 'hdr-rej' });
    built.grid.ready.mockRejectedValue(new Error('boom'));
    await built.runAfterNextRender();
    expect(built.grid.registerHeaderContent).not.toHaveBeenCalled();
  });

  it('destroy without prior registration does not call unregister', () => {
    const built = buildHeader({ id: 'hdr-noreg' });
    built.triggerDestroy();
    expect(built.grid.unregisterHeaderContent).not.toHaveBeenCalled();
  });
});

describe('GridToolbarContent (real directive)', () => {
  it('static ngTemplateContextGuard returns true', () => {
    expect(GridToolbarContent.ngTemplateContextGuard({} as GridToolbarContent, {})).toBe(true);
  });

  it('awaits grid.ready then calls registerToolbarContent with id + order', async () => {
    const built = buildToolbar({ id: 'tb-1', order: 3 });
    await built.runAfterNextRender();
    expect(built.grid.ready).toHaveBeenCalled();
    expect(built.grid.registerToolbarContent).toHaveBeenCalledTimes(1);
    expect(built.grid.toolbarDefs[0].id).toBe('tb-1');
    expect(built.grid.toolbarDefs[0].order).toBe(3);
  });

  it('falls back to a generated id when none is provided', async () => {
    const built = buildToolbar({ order: 0 });
    await built.runAfterNextRender();
    expect(built.grid.toolbarDefs[0].id).toMatch(/^tbw-toolbar-content-\d+$/);
  });

  it('skips registration if destroyed before ready() resolves', async () => {
    const built = buildToolbar({ id: 'tb-race' });
    let resolveReady: () => void = () => undefined;
    built.grid.ready.mockReturnValue(
      new Promise<void>((res) => {
        resolveReady = res;
      }),
    );
    const cbs = afterNextRenderCallbacks.splice(0);
    for (const cb of cbs) cb();
    built.triggerDestroy();
    resolveReady();
    await Promise.resolve();
    await Promise.resolve();
    expect(built.grid.registerToolbarContent).not.toHaveBeenCalled();
  });

  it('render callback is idempotent for sticky-container reuse', async () => {
    const built = buildToolbar({ id: 'tb-idem' });
    await built.runAfterNextRender();
    const def = built.grid.toolbarDefs[0];
    const container = document.createElement('div');
    def.render(container);
    expect(container.children.length).toBe(1);
    def.render(container);
    expect(container.children.length).toBe(1);
  });

  it('unregister is called on directive destroy', async () => {
    const built = buildToolbar({ id: 'tb-destroy' });
    await built.runAfterNextRender();
    built.triggerDestroy();
    expect(built.grid.unregisterToolbarContent).toHaveBeenCalledWith('tb-destroy');
  });

  it('re-registers when id changes after initial registration', async () => {
    const built = buildToolbar({ id: 'tb-a', order: 1 });
    await built.runAfterNextRender();
    (built.directive.id as unknown as { __setValue: (v: unknown) => void }).__setValue('tb-b');
    runEffects();
    await Promise.resolve();
    await Promise.resolve();
    expect(built.grid.unregisterToolbarContent).toHaveBeenCalledWith('tb-a');
    expect(built.grid.toolbarDefs.map((d) => d.id)).toEqual(['tb-a', 'tb-b']);
  });

  it('re-registers when order changes after initial registration', async () => {
    const built = buildToolbar({ id: 'tb-ord', order: 1 });
    await built.runAfterNextRender();
    (built.directive.order as unknown as { __setValue: (v: unknown) => void }).__setValue(9);
    runEffects();
    await Promise.resolve();
    await Promise.resolve();
    expect(built.grid.unregisterToolbarContent).toHaveBeenCalledWith('tb-ord');
    expect(built.grid.toolbarDefs.map((d) => d.order)).toEqual([1, 9]);
  });

  it('skips registration when grid.ready() rejects', async () => {
    const built = buildToolbar({ id: 'tb-rej' });
    built.grid.ready.mockRejectedValue(new Error('boom'));
    await built.runAfterNextRender();
    expect(built.grid.registerToolbarContent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Shell-plugin routing (#370)
// ---------------------------------------------------------------------------

interface ShellApi {
  registerHeaderContent: ReturnType<typeof vi.fn>;
  unregisterHeaderContent: ReturnType<typeof vi.fn>;
  registerToolbarContent: ReturnType<typeof vi.fn>;
  unregisterToolbarContent: ReturnType<typeof vi.fn>;
}

interface ShellMockGrid extends MockGrid {
  getPluginByName: ReturnType<typeof vi.fn>;
  shell: ShellApi;
}

function createShellMockGrid(): ShellMockGrid {
  const grid = createMockGrid() as ShellMockGrid;
  const shell: ShellApi = {
    registerHeaderContent: vi.fn((def: HeaderContentDefinition) => grid.headerDefs.push(def)),
    unregisterHeaderContent: vi.fn(),
    registerToolbarContent: vi.fn((def: ToolbarContentDefinition) => grid.toolbarDefs.push(def)),
    unregisterToolbarContent: vi.fn(),
  };
  grid.shell = shell;
  grid.getPluginByName = vi.fn((name: string) => (name === 'shell' ? shell : undefined));
  return grid;
}

function buildWithShell<D extends GridHeaderContent | GridToolbarContent>(
  DirectiveCtor: new () => D,
  hostTag: string,
  id: string,
): { directive: D; grid: ShellMockGrid; runAfterNextRender: () => Promise<void>; triggerDestroy: () => void } {
  afterNextRenderCallbacks.length = 0;
  effectCallbacks.length = 0;
  destroyCallback = null;
  const grid = createShellMockGrid();
  const host = document.createElement(hostTag);
  grid.appendChild(host);
  document.body.appendChild(grid);
  const elementRef = { nativeElement: host } as ElementRef<HTMLElement>;
  const viewContainerRef = createMockViewContainerRef();
  const destroyRef = {
    onDestroy: (cb: () => void) => {
      destroyCallback = cb;
      return () => undefined;
    },
  } as unknown as DestroyRef;
  mockInjectResolver = (token: unknown) => {
    if (token === ElementRef) return elementRef;
    if (token === ViewContainerRef) return viewContainerRef;
    if (token === DestroyRef) return destroyRef;
    return undefined;
  };
  const directive = new DirectiveCtor();
  (directive.id as unknown as { __setValue: (v: unknown) => void }).__setValue(id);
  const template = {} as TemplateRef<unknown>;
  (directive.template as unknown as { __setValue: (v: unknown) => void }).__setValue(template);
  return {
    directive,
    grid,
    runAfterNextRender: async () => {
      const cbs = afterNextRenderCallbacks.splice(0);
      for (const cb of cbs) cb();
      await Promise.resolve();
      await Promise.resolve();
    },
    triggerDestroy: () => destroyCallback?.(),
  };
}

describe('shell-plugin routing (#370)', () => {
  it('registers header content via the shell plugin, not the deprecated grid delegate', async () => {
    const built = buildWithShell(GridHeaderContent, 'tbw-grid-header-content', 'hdr-shell');
    await built.runAfterNextRender();
    expect(built.grid.shell.registerHeaderContent).toHaveBeenCalledTimes(1);
    expect(built.grid.registerHeaderContent).not.toHaveBeenCalled();
  });

  it('unregisters header content via the shell plugin on destroy', async () => {
    const built = buildWithShell(GridHeaderContent, 'tbw-grid-header-content', 'hdr-shell-2');
    await built.runAfterNextRender();
    built.triggerDestroy();
    expect(built.grid.shell.unregisterHeaderContent).toHaveBeenCalledWith('hdr-shell-2');
    expect(built.grid.unregisterHeaderContent).not.toHaveBeenCalled();
  });

  it('registers toolbar content via the shell plugin, not the deprecated grid delegate', async () => {
    const built = buildWithShell(GridToolbarContent, 'tbw-grid-toolbar-content', 'tb-shell');
    await built.runAfterNextRender();
    expect(built.grid.shell.registerToolbarContent).toHaveBeenCalledTimes(1);
    expect(built.grid.registerToolbarContent).not.toHaveBeenCalled();
  });

  it('unregisters toolbar content via the shell plugin on destroy', async () => {
    const built = buildWithShell(GridToolbarContent, 'tbw-grid-toolbar-content', 'tb-shell-2');
    await built.runAfterNextRender();
    built.triggerDestroy();
    expect(built.grid.shell.unregisterToolbarContent).toHaveBeenCalledWith('tb-shell-2');
    expect(built.grid.unregisterToolbarContent).not.toHaveBeenCalled();
  });
});
