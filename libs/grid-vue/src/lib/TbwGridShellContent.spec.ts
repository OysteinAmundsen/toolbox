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

async function mountWith(component: ReturnType<typeof defineComponent>): Promise<Harness> {
  const m = makeGrid();
  const gridRef = ref<DataGridElement | null>(m.grid as DataGridElement);
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
    grid: m.grid,
    slot: m.slot,
    headerDefs: m.headerDefs,
    toolbarDefs: m.toolbarDefs,
    unregisteredHeader: m.unregisteredHeader,
    unregisteredToolbar: m.unregisteredToolbar,
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
});

// `h` from vue collides with our harness object — alias.
function h2(...args: Parameters<typeof h>): ReturnType<typeof h> {
  return h(...args);
}
