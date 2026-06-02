/**
 * Tests for TbwGridHeaderContent and TbwGridToolbarContent SFC wrappers.
 *
 * @vitest-environment happy-dom
 */
import type { DataGridElement, HeaderContentDefinition, ToolbarContentDefinition } from '@toolbox-web/grid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue';
import TbwGridHeaderContent from './TbwGridHeaderContent.vue';
import TbwGridToolbarContent from './TbwGridToolbarContent.vue';
import { GRID_ELEMENT_KEY } from './use-grid';

interface MockGrid extends Partial<DataGridElement> {
  ready: () => Promise<void>;
  registerHeaderContent: (def: HeaderContentDefinition) => void;
  unregisterHeaderContent: (id: string) => void;
  registerToolbarContent: (def: ToolbarContentDefinition) => void;
  unregisterToolbarContent: (id: string) => void;
}

interface Harness {
  app: App;
  grid: MockGrid;
  slot: HTMLElement;
  mountEl: HTMLElement;
  headerDefs: HeaderContentDefinition[];
  toolbarDefs: ToolbarContentDefinition[];
  unregisteredHeader: string[];
  unregisteredToolbar: string[];
}

function makeGrid(): {
  grid: MockGrid;
  slot: HTMLElement;
  headerDefs: HeaderContentDefinition[];
  toolbarDefs: ToolbarContentDefinition[];
  unregisteredHeader: string[];
  unregisteredToolbar: string[];
} {
  const slot = document.createElement('div');
  const headerDefs: HeaderContentDefinition[] = [];
  const toolbarDefs: ToolbarContentDefinition[] = [];
  const unregisteredHeader: string[] = [];
  const unregisteredToolbar: string[] = [];
  const grid: MockGrid = {
    ready: vi.fn().mockResolvedValue(undefined),
    registerHeaderContent: vi.fn((def: HeaderContentDefinition) => {
      headerDefs.push(def);
      def.render(slot);
    }),
    unregisterHeaderContent: vi.fn((id: string) => {
      unregisteredHeader.push(id);
    }),
    registerToolbarContent: vi.fn((def: ToolbarContentDefinition) => {
      toolbarDefs.push(def);
      def.render(slot);
    }),
    unregisterToolbarContent: vi.fn((id: string) => {
      unregisteredToolbar.push(id);
    }),
  };
  return { grid, slot, headerDefs, toolbarDefs, unregisteredHeader, unregisteredToolbar };
}

let mountEl: HTMLElement;
let currentApp: App | null = null;

beforeEach(() => {
  mountEl = document.createElement('div');
  document.body.appendChild(mountEl);
});

afterEach(() => {
  try {
    currentApp?.unmount();
  } catch {
    /* ignore */
  }
  currentApp = null;
  document.body.innerHTML = '';
});

async function mountWith(
  component: ReturnType<typeof defineComponent>,
  opts: { grid?: MockGrid | null } = {},
): Promise<Harness> {
  const m = opts.grid === undefined ? makeGrid() : null;
  const grid = opts.grid === undefined ? m!.grid : opts.grid;
  const gridRef = ref<DataGridElement | null>((grid as DataGridElement | null) ?? null);
  const app = createApp(component);
  app.provide(GRID_ELEMENT_KEY, gridRef);
  app.mount(mountEl);
  currentApp = app;
  // Allow onMounted + awaited ready to flush.
  await nextTick();
  await Promise.resolve();
  await nextTick();
  return {
    app,
    mountEl,
    grid: (grid ?? makeGrid().grid) as MockGrid,
    slot: m?.slot ?? document.createElement('div'),
    headerDefs: m?.headerDefs ?? [],
    toolbarDefs: m?.toolbarDefs ?? [],
    unregisteredHeader: m?.unregisteredHeader ?? [],
    unregisteredToolbar: m?.unregisteredToolbar ?? [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TbwGridHeaderContent
// ═══════════════════════════════════════════════════════════════════════════

describe('TbwGridHeaderContent', () => {
  it('registers with the grid using provided id + order after ready resolves', async () => {
    const h = await mountWith(
      defineComponent({
        setup: () => () =>
          h2(TbwGridHeaderContent, { id: 'hdr-1', order: 5 }, () => h2('span', { 'data-testid': 'hdr' }, 'hello')),
      }),
    );
    expect(h.grid.ready).toHaveBeenCalled();
    expect(h.headerDefs).toHaveLength(1);
    expect(h.headerDefs[0]).toMatchObject({ id: 'hdr-1', order: 5 });
  });

  it('teleports slot content into the grid-provided container', async () => {
    const h = await mountWith(
      defineComponent({
        setup: () => () =>
          h2(TbwGridHeaderContent, { id: 'hdr-2' }, () => h2('span', { 'data-testid': 'hdr' }, 'hello')),
      }),
    );
    await nextTick();
    expect(h.slot.querySelector('[data-testid="hdr"]')?.textContent).toBe('hello');
  });

  it('updates teleported content reactively without re-registering', async () => {
    const label = ref('first');
    const h = await mountWith(
      defineComponent({
        setup: () => () =>
          h2(TbwGridHeaderContent, { id: 'hdr-3' }, () => h2('span', { 'data-testid': 'hdr' }, label.value)),
      }),
    );
    await nextTick();
    label.value = 'second';
    await nextTick();
    expect(h.grid.registerHeaderContent).toHaveBeenCalledTimes(1);
    expect(h.slot.querySelector('[data-testid="hdr"]')?.textContent).toBe('second');
  });

  it('unregisters on unmount', async () => {
    const h = await mountWith(
      defineComponent({
        setup: () => () => h2(TbwGridHeaderContent, { id: 'hdr-4' }, () => h2('span', null, 'x')),
      }),
    );
    h.app.unmount();
    currentApp = null;
    expect(h.unregisteredHeader).toContain('hdr-4');
  });

  it('re-registers when id changes after mount', async () => {
    const idProp = ref('hdr-id-a');
    const h = await mountWith(
      defineComponent({
        setup: () => () => h2(TbwGridHeaderContent, { id: idProp.value }, () => h2('span', null, 'x')),
      }),
    );
    expect(h.headerDefs.map((d) => d.id)).toEqual(['hdr-id-a']);
    idProp.value = 'hdr-id-b';
    await nextTick();
    await Promise.resolve();
    await nextTick();
    expect(h.unregisteredHeader).toContain('hdr-id-a');
    expect(h.headerDefs.map((d) => d.id)).toEqual(['hdr-id-a', 'hdr-id-b']);
  });

  it('re-registers when order changes after mount', async () => {
    const orderProp = ref(1);
    const h = await mountWith(
      defineComponent({
        setup: () => () =>
          h2(TbwGridHeaderContent, { id: 'hdr-ord', order: orderProp.value }, () => h2('span', null, 'x')),
      }),
    );
    orderProp.value = 9;
    await nextTick();
    await Promise.resolve();
    await nextTick();
    expect(h.unregisteredHeader).toContain('hdr-ord');
    expect(h.headerDefs.map((d) => d.order)).toEqual([1, 9]);
  });

  it('falls back to generated id when id prop becomes undefined', async () => {
    const idProp = ref<string | undefined>('hdr-named');
    const h = await mountWith(
      defineComponent({
        setup: () => () => h2(TbwGridHeaderContent, { id: idProp.value }, () => h2('span', null, 'x')),
      }),
    );
    idProp.value = undefined;
    await nextTick();
    await Promise.resolve();
    await nextTick();
    const newId = h.headerDefs[1]?.id;
    expect(newId).toMatch(/^tbw-header-content-/);
  });

  it('skips registration when grid.ready() rejects', async () => {
    const m = makeGrid();
    (m.grid.ready as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    const gridRef = ref<DataGridElement | null>(m.grid as DataGridElement);
    const app = createApp(
      defineComponent({
        setup: () => () => h2(TbwGridHeaderContent, { id: 'hdr-rej' }, () => h2('span', null, 'x')),
      }),
    );
    app.provide(GRID_ELEMENT_KEY, gridRef);
    app.mount(mountEl);
    currentApp = app;
    await nextTick();
    await Promise.resolve();
    await nextTick();
    expect(m.grid.registerHeaderContent).not.toHaveBeenCalled();
  });

  it('does not register when no parent grid is provided', async () => {
    const h = await mountWith(
      defineComponent({
        setup: () => () => h2(TbwGridHeaderContent, { id: 'hdr-nogrid' }, () => h2('span', null, 'x')),
      }),
      { grid: null },
    );
    expect(h.headerDefs).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TbwGridToolbarContent
// ═══════════════════════════════════════════════════════════════════════════

describe('TbwGridToolbarContent', () => {
  it('registers with the grid using provided id + order', async () => {
    const h = await mountWith(
      defineComponent({
        setup: () => () => h2(TbwGridToolbarContent, { id: 'tb-1', order: 3 }, () => h2('button', null, 'go')),
      }),
    );
    expect(h.toolbarDefs).toHaveLength(1);
    expect(h.toolbarDefs[0]).toMatchObject({ id: 'tb-1', order: 3 });
  });

  it('unregisters on unmount', async () => {
    const h = await mountWith(
      defineComponent({
        setup: () => () => h2(TbwGridToolbarContent, { id: 'tb-2' }, () => h2('button', null, 'go')),
      }),
    );
    h.app.unmount();
    currentApp = null;
    expect(h.unregisteredToolbar).toContain('tb-2');
  });

  it('re-registers when id changes after mount', async () => {
    const idProp = ref('tb-id-a');
    const h = await mountWith(
      defineComponent({
        setup: () => () => h2(TbwGridToolbarContent, { id: idProp.value }, () => h2('button', null, 'go')),
      }),
    );
    idProp.value = 'tb-id-b';
    await nextTick();
    await Promise.resolve();
    await nextTick();
    expect(h.unregisteredToolbar).toContain('tb-id-a');
    expect(h.toolbarDefs.map((d) => d.id)).toEqual(['tb-id-a', 'tb-id-b']);
  });

  it('re-registers when order changes after mount', async () => {
    const orderProp = ref(1);
    const h = await mountWith(
      defineComponent({
        setup: () => () =>
          h2(TbwGridToolbarContent, { id: 'tb-ord', order: orderProp.value }, () => h2('button', null, 'go')),
      }),
    );
    orderProp.value = 9;
    await nextTick();
    await Promise.resolve();
    await nextTick();
    expect(h.unregisteredToolbar).toContain('tb-ord');
    expect(h.toolbarDefs.map((d) => d.order)).toEqual([1, 9]);
  });

  it('skips registration when grid.ready() rejects', async () => {
    const m = makeGrid();
    (m.grid.ready as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    const gridRef = ref<DataGridElement | null>(m.grid as DataGridElement);
    const app = createApp(
      defineComponent({
        setup: () => () => h2(TbwGridToolbarContent, { id: 'tb-rej' }, () => h2('button', null, 'go')),
      }),
    );
    app.provide(GRID_ELEMENT_KEY, gridRef);
    app.mount(mountEl);
    currentApp = app;
    await nextTick();
    await Promise.resolve();
    await nextTick();
    expect(m.grid.registerToolbarContent).not.toHaveBeenCalled();
  });

  it('does not register when no parent grid is provided', async () => {
    const h = await mountWith(
      defineComponent({
        setup: () => () => h2(TbwGridToolbarContent, { id: 'tb-nogrid' }, () => h2('button', null, 'go')),
      }),
      { grid: null },
    );
    expect(h.toolbarDefs).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Shell-plugin routing (#370)
// ═══════════════════════════════════════════════════════════════════════════

interface ShellApi {
  registerHeaderContent: ReturnType<typeof vi.fn>;
  unregisterHeaderContent: ReturnType<typeof vi.fn>;
  registerToolbarContent: ReturnType<typeof vi.fn>;
  unregisterToolbarContent: ReturnType<typeof vi.fn>;
}

function makeShellGrid(): { grid: DataGridElement; shell: ShellApi; delegates: ShellApi } {
  const slot = document.createElement('div');
  const shell: ShellApi = {
    registerHeaderContent: vi.fn((def: HeaderContentDefinition) => def.render(slot)),
    unregisterHeaderContent: vi.fn(),
    registerToolbarContent: vi.fn((def: ToolbarContentDefinition) => def.render(slot)),
    unregisterToolbarContent: vi.fn(),
  };
  // Deprecated grid-element delegates — must NOT be called when a shell plugin exists.
  const delegates: ShellApi = {
    registerHeaderContent: vi.fn(),
    unregisterHeaderContent: vi.fn(),
    registerToolbarContent: vi.fn(),
    unregisterToolbarContent: vi.fn(),
  };
  const grid = {
    ready: vi.fn().mockResolvedValue(undefined),
    getPluginByName: vi.fn((name: string) => (name === 'shell' ? shell : undefined)),
    ...delegates,
  } as unknown as DataGridElement;
  return { grid, shell, delegates };
}

async function mountShellGrid(component: ReturnType<typeof defineComponent>, grid: DataGridElement): Promise<App> {
  const gridRef = ref<DataGridElement | null>(grid);
  const app = createApp(component);
  app.provide(GRID_ELEMENT_KEY, gridRef);
  app.mount(mountEl);
  currentApp = app;
  await nextTick();
  await Promise.resolve();
  await nextTick();
  return app;
}

describe('shell-plugin routing (#370)', () => {
  it('registers header content via the shell plugin, not the deprecated grid delegate', async () => {
    const { grid, shell, delegates } = makeShellGrid();
    await mountShellGrid(
      defineComponent({
        setup: () => () => h2(TbwGridHeaderContent, { id: 'hdr-shell' }, () => h2('span', null, 'x')),
      }),
      grid,
    );
    expect(shell.registerHeaderContent).toHaveBeenCalledTimes(1);
    expect(delegates.registerHeaderContent).not.toHaveBeenCalled();
  });

  it('unregisters header content via the shell plugin on unmount', async () => {
    const { grid, shell, delegates } = makeShellGrid();
    const app = await mountShellGrid(
      defineComponent({
        setup: () => () => h2(TbwGridHeaderContent, { id: 'hdr-shell-2' }, () => h2('span', null, 'x')),
      }),
      grid,
    );
    app.unmount();
    currentApp = null;
    expect(shell.unregisterHeaderContent).toHaveBeenCalledWith('hdr-shell-2');
    expect(delegates.unregisterHeaderContent).not.toHaveBeenCalled();
  });

  it('registers toolbar content via the shell plugin, not the deprecated grid delegate', async () => {
    const { grid, shell, delegates } = makeShellGrid();
    await mountShellGrid(
      defineComponent({
        setup: () => () => h2(TbwGridToolbarContent, { id: 'tb-shell' }, () => h2('button', null, 'x')),
      }),
      grid,
    );
    expect(shell.registerToolbarContent).toHaveBeenCalledTimes(1);
    expect(delegates.registerToolbarContent).not.toHaveBeenCalled();
  });

  it('unregisters toolbar content via the shell plugin on unmount', async () => {
    const { grid, shell, delegates } = makeShellGrid();
    const app = await mountShellGrid(
      defineComponent({
        setup: () => () => h2(TbwGridToolbarContent, { id: 'tb-shell-2' }, () => h2('button', null, 'x')),
      }),
      grid,
    );
    app.unmount();
    currentApp = null;
    expect(shell.unregisterToolbarContent).toHaveBeenCalledWith('tb-shell-2');
    expect(delegates.unregisterToolbarContent).not.toHaveBeenCalled();
  });
});

// `h` from vue collides with our harness object — alias.
function h2(...args: Parameters<typeof h>): ReturnType<typeof h> {
  return h(...args);
}
