/**
 * Tests for GridHeaderContent and GridToolbarContent wrappers.
 *
 * Verifies the imperative bridging contract:
 * - Calls `register*Content` with id + order after grid.ready resolves
 * - Mounts children into the container the grid hands to the render callback
 * - Forwards children updates without re-registering
 * - Calls `unregister*Content` on unmount
 *
 * @vitest-environment happy-dom
 */
import type { DataGridElement } from '@toolbox-web/grid';
import type { HeaderContentDefinition, ToolbarContentDefinition } from '@toolbox-web/grid/plugins/shell';
import { act, createRef, useState, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GridElementContext } from './grid-element-context';
import { GridHeaderContent } from './grid-header-content';
import { GridToolbarContent } from './grid-toolbar-content';

beforeAll(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

interface MockShell {
  registerHeaderContent: (def: HeaderContentDefinition) => void;
  unregisterHeaderContent: (id: string) => void;
  registerToolbarContent: (def: ToolbarContentDefinition) => void;
  unregisterToolbarContent: (id: string) => void;
}

interface MockGrid extends Partial<DataGridElement> {
  ready: () => Promise<void>;
  getPluginByName: (name: string) => unknown;
}

interface Harness {
  grid: MockGrid;
  /** Shell-plugin mock the wrappers route register/unregister through (#370). */
  shell: MockShell;
  gridRef: RefObject<DataGridElement | null>;
  container: HTMLElement;
  /** Container the grid would hand to the render callback. */
  slot: HTMLElement;
  root: Root;
  headerDefs: HeaderContentDefinition[];
  toolbarDefs: ToolbarContentDefinition[];
  unregisteredHeader: string[];
  unregisteredToolbar: string[];
}

function setupHarness(): Harness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const slot = document.createElement('div');
  const headerDefs: HeaderContentDefinition[] = [];
  const toolbarDefs: ToolbarContentDefinition[] = [];
  const unregisteredHeader: string[] = [];
  const unregisteredToolbar: string[] = [];
  const shell: MockShell = {
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
  const grid: MockGrid = {
    ready: vi.fn().mockResolvedValue(undefined),
    getPluginByName: vi.fn((name: string) => (name === 'shell' ? shell : undefined)),
  };
  const gridRef: RefObject<DataGridElement | null> = createRef<DataGridElement | null>();
  (gridRef as { current: DataGridElement | null }).current = grid as DataGridElement;
  const root = createRoot(container);
  return {
    grid,
    shell,
    gridRef,
    container,
    slot,
    root,
    headerDefs,
    toolbarDefs,
    unregisteredHeader,
    unregisteredToolbar,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

// ═══════════════════════════════════════════════════════════════════════════
// GridHeaderContent
// ═══════════════════════════════════════════════════════════════════════════

describe('GridHeaderContent', () => {
  it('registers with the grid using provided id + order after ready resolves', async () => {
    const h = setupHarness();
    await act(async () => {
      h.root.render(
        <GridElementContext.Provider value={h.gridRef}>
          <GridHeaderContent id="hdr-1" order={5}>
            <span data-testid="hdr">hello</span>
          </GridHeaderContent>
        </GridElementContext.Provider>,
      );
    });
    expect(h.grid.ready).toHaveBeenCalled();
    expect(h.headerDefs).toHaveLength(1);
    expect(h.headerDefs[0]).toMatchObject({ id: 'hdr-1', order: 5 });
  });

  it('mounts children into the grid-provided container via portal', async () => {
    const h = setupHarness();
    await act(async () => {
      h.root.render(
        <GridElementContext.Provider value={h.gridRef}>
          <GridHeaderContent id="hdr-2">
            <span data-testid="hdr">hello</span>
          </GridHeaderContent>
        </GridElementContext.Provider>,
      );
    });
    // PortalManager flushes via microtask + rAF.
    await act(async () => {
      await new Promise((r) => queueMicrotask(r));
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    });
    expect(h.slot.querySelector('[data-testid="hdr"]')?.textContent).toBe('hello');
  });

  it('forwards children updates without re-registering', async () => {
    const h = setupHarness();
    let setLabel!: (s: string) => void;
    function Harness() {
      const [label, _set] = useState('first');
      setLabel = _set;
      return (
        <GridElementContext.Provider value={h.gridRef}>
          <GridHeaderContent id="hdr-3">
            <span data-testid="hdr">{label}</span>
          </GridHeaderContent>
        </GridElementContext.Provider>
      );
    }
    await act(async () => {
      h.root.render(<Harness />);
    });
    await act(async () => {
      setLabel('second');
      await new Promise((r) => queueMicrotask(r));
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    });
    expect(h.shell.registerHeaderContent).toHaveBeenCalledTimes(1);
    expect(h.slot.querySelector('[data-testid="hdr"]')?.textContent).toBe('second');
  });

  it('unregisters on unmount', async () => {
    const h = setupHarness();
    await act(async () => {
      h.root.render(
        <GridElementContext.Provider value={h.gridRef}>
          <GridHeaderContent id="hdr-4">
            <span>x</span>
          </GridHeaderContent>
        </GridElementContext.Provider>,
      );
    });
    await act(async () => {
      h.root.unmount();
    });
    expect(h.unregisteredHeader).toContain('hdr-4');
  });

  it('renders null host (no extra DOM)', async () => {
    const h = setupHarness();
    await act(async () => {
      h.root.render(
        <GridElementContext.Provider value={h.gridRef}>
          <GridHeaderContent id="hdr-5">
            <span>x</span>
          </GridHeaderContent>
        </GridElementContext.Provider>,
      );
    });
    // The wrapper itself returns null; only the portal's container (h.slot) holds DOM.
    // h.container is the React root container, which holds nothing visible.
    expect(h.container.children.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GridToolbarContent
// ═══════════════════════════════════════════════════════════════════════════

describe('GridToolbarContent', () => {
  it('registers with the grid using provided id + order', async () => {
    const h = setupHarness();
    await act(async () => {
      h.root.render(
        <GridElementContext.Provider value={h.gridRef}>
          <GridToolbarContent id="tb-1" order={3}>
            <button>go</button>
          </GridToolbarContent>
        </GridElementContext.Provider>,
      );
    });
    expect(h.toolbarDefs).toHaveLength(1);
    expect(h.toolbarDefs[0]).toMatchObject({ id: 'tb-1', order: 3 });
  });

  it('unregisters on unmount', async () => {
    const h = setupHarness();
    await act(async () => {
      h.root.render(
        <GridElementContext.Provider value={h.gridRef}>
          <GridToolbarContent id="tb-2">
            <button>go</button>
          </GridToolbarContent>
        </GridElementContext.Provider>,
      );
    });
    await act(async () => {
      h.root.unmount();
    });
    expect(h.unregisteredToolbar).toContain('tb-2');
  });

  it('renders nothing when not inside a grid context', async () => {
    const h = setupHarness();
    await act(async () => {
      h.root.render(
        <GridElementContext.Provider value={null}>
          <GridToolbarContent id="tb-3">
            <button>x</button>
          </GridToolbarContent>
        </GridElementContext.Provider>,
      );
    });
    expect(h.toolbarDefs).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Shell-plugin routing (#370)
// ═══════════════════════════════════════════════════════════════════════════

interface ShellApi {
  registerHeaderContent: (def: HeaderContentDefinition) => void;
  unregisterHeaderContent: (id: string) => void;
  registerToolbarContent: (def: ToolbarContentDefinition) => void;
  unregisterToolbarContent: (id: string) => void;
}

interface ShellHarness {
  gridRef: RefObject<DataGridElement | null>;
  root: Root;
  shell: ShellApi;
  /** Deprecated grid-element delegates — must NOT be called when a shell plugin exists. */
  gridDelegates: {
    registerHeaderContent: ReturnType<typeof vi.fn>;
    unregisterHeaderContent: ReturnType<typeof vi.fn>;
    registerToolbarContent: ReturnType<typeof vi.fn>;
    unregisterToolbarContent: ReturnType<typeof vi.fn>;
  };
}

function setupShellHarness(): ShellHarness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const slot = document.createElement('div');

  const shell: ShellApi = {
    registerHeaderContent: vi.fn((def: HeaderContentDefinition) => def.render(slot)),
    unregisterHeaderContent: vi.fn(),
    registerToolbarContent: vi.fn((def: ToolbarContentDefinition) => def.render(slot)),
    unregisterToolbarContent: vi.fn(),
  };
  const gridDelegates = {
    registerHeaderContent: vi.fn(),
    unregisterHeaderContent: vi.fn(),
    registerToolbarContent: vi.fn(),
    unregisterToolbarContent: vi.fn(),
  };

  const grid: Partial<DataGridElement> = {
    ready: vi.fn().mockResolvedValue(undefined),
    getPluginByName: vi.fn((name: string) => (name === 'shell' ? shell : undefined)),
    ...gridDelegates,
  };

  const gridRef: RefObject<DataGridElement | null> = createRef<DataGridElement | null>();
  (gridRef as { current: DataGridElement | null }).current = grid as DataGridElement;
  const root = createRoot(container);
  return { gridRef, root, shell, gridDelegates };
}

describe('shell-plugin routing (#370)', () => {
  it('registers header content via the shell plugin, not the deprecated grid delegate', async () => {
    const h = setupShellHarness();
    await act(async () => {
      h.root.render(
        <GridElementContext.Provider value={h.gridRef}>
          <GridHeaderContent id="hdr-shell">
            <span>x</span>
          </GridHeaderContent>
        </GridElementContext.Provider>,
      );
    });
    expect(h.shell.registerHeaderContent).toHaveBeenCalledTimes(1);
    expect(h.gridDelegates.registerHeaderContent).not.toHaveBeenCalled();
  });

  it('unregisters header content via the shell plugin on unmount', async () => {
    const h = setupShellHarness();
    await act(async () => {
      h.root.render(
        <GridElementContext.Provider value={h.gridRef}>
          <GridHeaderContent id="hdr-shell-2">
            <span>x</span>
          </GridHeaderContent>
        </GridElementContext.Provider>,
      );
    });
    await act(async () => {
      h.root.unmount();
    });
    expect(h.shell.unregisterHeaderContent).toHaveBeenCalledWith('hdr-shell-2');
    expect(h.gridDelegates.unregisterHeaderContent).not.toHaveBeenCalled();
  });

  it('registers toolbar content via the shell plugin, not the deprecated grid delegate', async () => {
    const h = setupShellHarness();
    await act(async () => {
      h.root.render(
        <GridElementContext.Provider value={h.gridRef}>
          <GridToolbarContent id="tb-shell">
            <button>x</button>
          </GridToolbarContent>
        </GridElementContext.Provider>,
      );
    });
    expect(h.shell.registerToolbarContent).toHaveBeenCalledTimes(1);
    expect(h.gridDelegates.registerToolbarContent).not.toHaveBeenCalled();
  });

  it('unregisters toolbar content via the shell plugin on unmount', async () => {
    const h = setupShellHarness();
    await act(async () => {
      h.root.render(
        <GridElementContext.Provider value={h.gridRef}>
          <GridToolbarContent id="tb-shell-2">
            <button>x</button>
          </GridToolbarContent>
        </GridElementContext.Provider>,
      );
    });
    await act(async () => {
      h.root.unmount();
    });
    expect(h.shell.unregisterToolbarContent).toHaveBeenCalledWith('tb-shell-2');
    expect(h.gridDelegates.unregisterToolbarContent).not.toHaveBeenCalled();
  });
});
