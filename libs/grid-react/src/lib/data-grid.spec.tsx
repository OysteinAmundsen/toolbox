/**
 * Tests for DataGrid ref callback behaviour.
 *
 * @vitest-environment happy-dom
 *
 * Regression: the ref callback used to assign `gridConfig`, `rows`, and `columns`
 * onto the underlying `<tbw-grid>` element on every render. React detaches and
 * re-attaches inline ref callbacks on every render, which meant any parent re-render
 * (e.g. a height-resize observer firing) would re-set `gridConfig`. That caused
 * ConfigManager to flag sources as changed, and the next merge() would rebuild
 * `effectiveConfig.columns` from the original `gridConfig.columns`, wiping
 * runtime state like `col.hidden` written by the visibility plugin or
 * `applyColumnState`. The ref callback must only sync on first attach.
 */
import type { DataGridElement, GridConfig } from '@toolbox-web/grid';
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
import { GroupingRowsPlugin } from '@toolbox-web/grid/plugins/grouping-rows';
import { act, createContext, StrictMode, useContext, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import '../features/filtering';
import '../features/grouping-rows';
import '../features/pinned-rows';
import '../features/selection';
import { DataGrid } from './data-grid';
import { getPortalManager, setPortalManager } from './portal-bridge';
import type { GridConfig as ReactGridConfig } from './react-column-config';

beforeAll(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

type Row = { id: number; name: string };

describe('DataGrid feature props', () => {
  async function waitForRenderer(renderer: () => unknown) {
    await act(async () => vi.waitFor(() => expect(renderer).toHaveBeenCalled()));
  }

  async function unmount(root: ReturnType<typeof createRoot>, container: HTMLElement) {
    await act(async () => root.unmount());
    container.remove();
  }

  it('uses the latest grouping renderer after a callback-only change', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const groupOn = (row: { department: string }) => row.department;
    const first = vi.fn(() => <span>A</span>);
    const second = vi.fn(() => <span>B</span>);
    const initialRows = [{ department: 'Engineering', name: 'Alice' }];

    await act(async () => {
      root.render(
        <DataGrid rows={initialRows} groupingRows={{ groupOn, defaultExpanded: false, groupRowRenderer: first }} />,
      );
    });
    await waitForRenderer(first);
    const grid = container.querySelector('tbw-grid') as DataGridElement;
    const initialPlugin = grid.getPluginByName('groupingRows');

    await act(async () => {
      root.render(
        <DataGrid rows={initialRows} groupingRows={{ groupOn, defaultExpanded: false, groupRowRenderer: first }} />,
      );
    });
    expect(grid.getPluginByName('groupingRows')).toBe(initialPlugin);
    const grouping = grid.getPlugin(GroupingRowsPlugin);
    if (!grouping) throw new Error('Grouping plugin was not attached');
    await act(async () => grouping.expand('Engineering'));
    expect(grouping.isExpanded('Engineering')).toBe(true);

    await act(async () => {
      root.render(
        <DataGrid rows={initialRows} groupingRows={{ groupOn, defaultExpanded: false, groupRowRenderer: second }} />,
      );
    });
    await waitForRenderer(second);
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('B')));

    const updatedPlugin = grid.getPluginByName('groupingRows');
    expect(grid.getPlugin(GroupingRowsPlugin)?.isExpanded('Engineering')).toBe(true);
    expect(updatedPlugin).toBe(initialPlugin);
    await act(async () => {
      root.render(<DataGrid rows={initialRows} groupingRows={{ groupOn, defaultExpanded: false }} />);
    });
    expect(grid.getPluginByName('groupingRows')).not.toBe(updatedPlugin);
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('Engineering')));

    await unmount(root, container);
  });

  it('updates a nested pinned-row renderer when its callback changes', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ name: 'Alice', department: 'Engineering' }];
    const groupOn = (row: { department: string }) => row.department;
    const first = vi.fn(() => 'A');
    const second = vi.fn(() => 'B');

    await act(async () => {
      root.render(
        <DataGrid
          rows={rows}
          groupingRows={{ groupOn, defaultExpanded: false }}
          pinnedRows={{ slots: [{ position: 'top', render: first }] }}
        />,
      );
    });
    await waitForRenderer(first);
    const grid = container.querySelector('tbw-grid') as DataGridElement;
    const plugin = grid.getPluginByName('pinnedRows');
    const grouping = grid.getPlugin(GroupingRowsPlugin);
    if (!grouping) throw new Error('Grouping plugin was not attached');
    await act(async () => grouping.expand('Engineering'));
    await act(async () => {
      root.render(
        <DataGrid
          rows={rows}
          groupingRows={{ groupOn, defaultExpanded: false }}
          pinnedRows={{ slots: [{ position: 'top', render: first }] }}
        />,
      );
    });
    expect(grid.getPluginByName('pinnedRows')).toBe(plugin);
    await act(async () => {
      root.render(
        <DataGrid
          rows={rows}
          groupingRows={{ groupOn, defaultExpanded: false }}
          pinnedRows={{ slots: [{ position: 'top', render: second }] }}
        />,
      );
    });
    await waitForRenderer(second);
    expect(grid.getPluginByName('pinnedRows')).toBe(plugin);
    expect(grid.getPlugin(GroupingRowsPlugin)?.isExpanded('Engineering')).toBe(true);

    await unmount(root, container);
  });

  it('does not emit data-change when only a renderer changes', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ department: 'Engineering' }];
    const groupOn = (row: (typeof rows)[number]) => row.department;
    const first = vi.fn(() => 'A');
    const second = vi.fn(() => 'B');

    await act(async () => root.render(<DataGrid rows={rows} groupingRows={{ groupOn, groupRowRenderer: first }} />));
    await waitForRenderer(first);
    const grid = container.querySelector('tbw-grid') as DataGridElement;
    const onDataChange = vi.fn();
    grid.addEventListener('data-change', onDataChange);
    await act(async () => root.render(<DataGrid rows={rows} groupingRows={{ groupOn, groupRowRenderer: second }} />));
    await waitForRenderer(second);
    expect(onDataChange).not.toHaveBeenCalled();

    await unmount(root, container);
  });

  it('does not emit data-change when a pinned-row renderer changes', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ name: 'Alice' }];
    const first = vi.fn(() => 'A');
    const second = vi.fn(() => 'B');
    const render = async (renderer: typeof first) => {
      await act(async () =>
        root.render(<DataGrid rows={rows} pinnedRows={{ slots: [{ position: 'top', render: renderer }] }} />),
      );
    };
    await render(first);
    await waitForRenderer(first);
    const grid = container.querySelector('tbw-grid') as DataGridElement;
    const onDataChange = vi.fn();
    grid.addEventListener('data-change', onDataChange);
    await render(second);
    await waitForRenderer(second);
    expect(onDataChange).not.toHaveBeenCalled();

    await unmount(root, container);
  });

  it('preserves group renderer component state and focus on callback changes', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ department: 'Engineering' }];
    const groupOn = (row: (typeof rows)[number]) => row.department;
    function StatefulGroup({ label }: { label: string }) {
      const [count, setCount] = useState(0);
      return <button onClick={() => setCount(count + 1)}>{`${label}:${count}`}</button>;
    }
    const first = vi.fn(() => <StatefulGroup label="A" />);
    const second = vi.fn(() => <StatefulGroup label="B" />);

    await act(async () => root.render(<DataGrid rows={rows} groupingRows={{ groupOn, groupRowRenderer: first }} />));
    await waitForRenderer(first);
    const button = container.querySelector('button');
    if (!button) throw new Error('Group renderer button was not rendered');
    await act(async () => button.click());
    button.focus();
    expect(button.textContent).toBe('A:1');
    await act(async () => root.render(<DataGrid rows={rows} groupingRows={{ groupOn, groupRowRenderer: second }} />));
    await waitForRenderer(second);
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('B:1')));
    expect(container.querySelector('button')).toBe(button);
    expect(document.activeElement).toBe(button);

    await unmount(root, container);
  });

  it('updates group renderers when their result changes between React, DOM and empty output', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ department: 'Engineering' }];
    const groupOn = (row: (typeof rows)[number]) => row.department;
    const render = async (groupRowRenderer: (() => ReactNode) | (() => HTMLElement)) => {
      await act(async () => root.render(<DataGrid rows={rows} groupingRows={{ groupOn, groupRowRenderer }} />));
    };
    const cleanup = vi.fn();
    function Group() {
      useEffect(() => cleanup, []);
      return <span>React</span>;
    }
    const dom = document.createElement('strong');
    dom.textContent = 'DOM';
    await render(() => <Group />);
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('React')));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    const grid = container.querySelector('tbw-grid') as DataGridElement;
    const onDataChange = vi.fn();
    grid.addEventListener('data-change', onDataChange);
    await render(() => dom);
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('DOM')));
    await act(async () => vi.waitFor(() => expect(cleanup).toHaveBeenCalledOnce()));
    await render(() => null);
    await act(async () => vi.waitFor(() => expect(container.textContent).not.toContain('DOM')));
    await render(() => <span>React again</span>);
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('React again')));
    expect(onDataChange).not.toHaveBeenCalled();

    await unmount(root, container);
  });

  it('keeps a focused group host connected when another group changes output type', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ department: 'Engineering' }, { department: 'Sales' }];
    const groupOn = (row: (typeof rows)[number]) => row.department;
    const sales = document.createElement('span');
    sales.textContent = 'Sales group';
    const render = async (label: string) => {
      await act(async () =>
        root.render(
          <DataGrid
            rows={rows}
            groupingRows={{
              groupOn,
              groupRowRenderer: ({ value }) =>
                value === 'Engineering' ? <input aria-label={label} /> : label === 'second' ? sales : null,
            }}
          />,
        ),
      );
    };
    await render('first');
    await act(async () => vi.waitFor(() => expect(container.querySelector('input')).not.toBeNull()));
    const input = container.querySelector('input');
    const row = input?.closest('.group-row');
    if (!input || !row) throw new Error('Group input was not rendered');
    const replaceChildren = vi.spyOn(row, 'replaceChildren');
    input.focus();
    await render('second');
    await act(async () => vi.waitFor(() => expect(input.getAttribute('aria-label')).toBe('second')));
    expect(container.textContent).toContain('Sales group');
    expect(replaceChildren).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
    await unmount(root, container);
  });

  it('unmounts pinned React output when its renderer changes to DOM or empty', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ name: 'Alice' }];
    const cleanup = vi.fn();
    function Panel() {
      useEffect(() => cleanup, []);
      return <span>React panel</span>;
    }
    const render = async (renderer: () => ReactNode | HTMLElement) => {
      await act(async () =>
        root.render(
          <DataGrid rows={rows} pinnedRows={{ slots: [{ id: 'panel', position: 'top', render: renderer }] }} />,
        ),
      );
    };
    const dom = document.createElement('strong');
    dom.textContent = 'DOM panel';
    await render(() => <Panel />);
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('React panel')));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    await render(() => dom);
    await act(async () => vi.waitFor(() => expect(cleanup).toHaveBeenCalledTimes(1)));
    await render(() => <Panel />);
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('React panel')));
    await render(() => null);
    await act(async () => vi.waitFor(() => expect(cleanup).toHaveBeenCalledTimes(2)));
    await unmount(root, container);
  });

  it('preserves each grid context when pinned output changes from empty or DOM to React', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ name: 'Alice' }];
    const Context = createContext('fallback');
    const dom = document.createElement('strong');
    function Panel() {
      return <span>{useContext(Context)}</span>;
    }
    const empty = vi.fn(() => null);
    const render = async (show: boolean) => {
      await act(async () =>
        root.render(
          <>
            <Context.Provider value="first context">
              <DataGrid
                rows={rows}
                pinnedRows={{ slots: [{ position: 'top', render: show ? () => <Panel /> : empty }] }}
              />
            </Context.Provider>
            <Context.Provider value="second context">
              <DataGrid
                rows={rows}
                pinnedRows={{ slots: [{ position: 'top', render: show ? () => <Panel /> : () => dom }] }}
              />
            </Context.Provider>
          </>,
        ),
      );
    };
    await render(false);
    await waitForRenderer(empty);
    await act(async () => vi.waitFor(() => expect(container.contains(dom)).toBe(true)));
    await render(true);
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('first context')));
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('second context')));
    expect(container.textContent).not.toContain('fallback');
    await unmount(root, container);
  });

  it('keeps an anonymous pinned panel focused on callback-only updates', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ name: 'Alice' }];
    const render = async (label: string) => {
      await act(async () =>
        root.render(
          <DataGrid
            rows={rows}
            pinnedRows={{ slots: [{ position: 'top', render: () => <input aria-label={label} /> }] }}
          />,
        ),
      );
    };
    await render('first');
    await act(async () => vi.waitFor(() => expect(container.querySelector('input')).not.toBeNull()));
    const input = container.querySelector('input');
    const wrapper = input?.closest('.tbw-header-pinned');
    if (!input || !wrapper) throw new Error('Pinned input was not rendered');
    const replaceChildren = vi.spyOn(wrapper, 'replaceChildren');
    input.focus();
    await render('second');
    await act(async () => vi.waitFor(() => expect(input.getAttribute('aria-label')).toBe('second')));
    expect(replaceChildren).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
    await unmount(root, container);
  });

  it('updates grouping and pinned renderers in StrictMode', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ department: 'Engineering' }];
    const groupOn = (row: (typeof rows)[number]) => row.department;
    const render = async (label: string) => {
      await act(async () =>
        root.render(
          <StrictMode>
            <DataGrid
              rows={rows}
              groupingRows={{ groupOn, groupRowRenderer: () => <span>group {label}</span> }}
              pinnedRows={{ slots: [{ position: 'top', render: () => <span>panel {label}</span> }] }}
            />
          </StrictMode>,
        ),
      );
    };
    await render('first');
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('group first')));
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('panel first')));
    await render('second');
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('group second')));
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('panel second')));
    await unmount(root, container);
  });

  it('uses the nearest versioned grid portal manager when a group changes to React output', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ department: 'Engineering' }];
    const groupOn = (row: (typeof rows)[number]) => row.department;
    const placeholder = document.createElement('span');
    const render = async (groupRowRenderer: () => ReactNode | HTMLElement) => {
      await act(async () => root.render(<DataGrid rows={rows} groupingRows={{ groupOn, groupRowRenderer }} />));
    };
    await render(() => placeholder);
    await act(async () => vi.waitFor(() => expect(placeholder.isConnected).toBe(true)));
    const grid = container.querySelector('tbw-grid');
    if (!grid) throw new Error('Grid was not rendered');
    const manager = getPortalManager(grid);
    if (!manager) throw new Error('Grid portal manager was not registered');
    const versionedGrid = document.createElement('tbw-grid-v1');
    versionedGrid.setAttribute('data-tbw-grid', '');
    placeholder.replaceWith(versionedGrid);
    versionedGrid.appendChild(placeholder);
    const renderPortal = vi.fn(manager.renderPortal);
    setPortalManager(versionedGrid, { ...manager, renderPortal });
    await render(() => <span>React group</span>);
    expect(renderPortal).toHaveBeenCalled();
    setPortalManager(versionedGrid, null);
    await unmount(root, container);
  });

  it('preserves a focused pinned zone when a sibling changes output', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ name: 'Alice' }];
    const dom = document.createElement('strong');
    dom.textContent = 'Other zone';
    const render = async (show: boolean) => {
      await act(async () =>
        root.render(
          <DataGrid
            rows={rows}
            pinnedRows={{
              slots: [
                {
                  id: 'panel',
                  position: 'top',
                  render: [
                    { zone: 'left', render: () => <input aria-label="focused" /> },
                    { zone: 'right', render: () => (show ? dom : null) },
                  ],
                },
              ],
            }}
          />,
        ),
      );
    };
    await render(false);
    await act(async () => vi.waitFor(() => expect(container.querySelector('input')).not.toBeNull()));
    const input = container.querySelector('input');
    const wrapper = input?.closest('.tbw-header-pinned');
    if (!input || !wrapper) throw new Error('Pinned input was not rendered');
    const replaceChildren = vi.spyOn(wrapper, 'replaceChildren');
    input.focus();
    await render(true);
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('Other zone')));
    expect(replaceChildren).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
    await unmount(root, container);
  });

  it('does not request a pinned refresh for unchanged empty and DOM output', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ name: 'Alice' }];
    const dom = document.createElement('strong');
    const render = async () => {
      await act(async () =>
        root.render(
          <DataGrid
            rows={rows}
            pinnedRows={{
              slots: [
                { position: 'top', render: () => null },
                { position: 'bottom', render: () => dom },
              ],
            }}
          />,
        ),
      );
    };
    await render();
    await act(async () => vi.waitFor(() => expect(container.contains(dom)).toBe(true)));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    const grid = container.querySelector('tbw-grid') as DataGridElement;
    const requestAfterRender = vi.spyOn(grid, 'requestAfterRender');
    await render();
    expect(requestAfterRender).not.toHaveBeenCalled();
    await unmount(root, container);
  });

  it('updates zoned pinned-row renderers independently', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ name: 'Alice' }];
    const first = vi.fn(() => 'A');
    const second = vi.fn(() => 'B');
    const right = vi.fn(() => 'R');
    const render = async (left: typeof first) => {
      await act(async () => {
        root.render(
          <DataGrid
            rows={rows}
            pinnedRows={{
              slots: [
                {
                  position: 'top',
                  render: [
                    { zone: 'left', render: left },
                    { zone: 'right', render: right },
                  ],
                },
              ],
            }}
          />,
        );
      });
    };

    await render(first);
    await waitForRenderer(first);
    const grid = container.querySelector('tbw-grid') as DataGridElement;
    const plugin = grid.getPluginByName('pinnedRows');
    await render(second);
    await waitForRenderer(second);
    expect(grid.getPluginByName('pinnedRows')).toBe(plugin);
    expect(right).toHaveBeenCalled();

    await unmount(root, container);
  });

  it('updates a renderer omitted by the feature configuration toJSON', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ department: 'Engineering' }];
    const groupOn = (row: { department: string }) => row.department;
    const first = vi.fn(() => 'A');
    const second = vi.fn(() => 'B');
    const config = (renderer: typeof first) => ({
      groupOn,
      groupRowRenderer: renderer,
      toJSON() {
        return { groupOn };
      },
    });

    await act(async () => root.render(<DataGrid rows={rows} groupingRows={config(first)} />));
    await waitForRenderer(first);
    const grid = container.querySelector('tbw-grid') as DataGridElement;
    const plugin = grid.getPluginByName('groupingRows');
    await act(async () => root.render(<DataGrid rows={rows} groupingRows={config(second)} />));
    await waitForRenderer(second);
    expect(grid.getPluginByName('groupingRows')).toBe(plugin);
    const withoutRenderer = { groupOn, toJSON: () => ({ groupOn }) };
    await act(async () => root.render(<DataGrid rows={rows} groupingRows={withoutRenderer} />));
    expect(grid.getPluginByName('groupingRows')).not.toBe(plugin);

    await unmount(root, container);
  });

  it('updates a renderer in a cyclic feature configuration', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ department: 'Engineering' }];
    const first = vi.fn(() => 'A');
    const second = vi.fn(() => 'B');
    const extra: { self?: unknown } = {};
    extra.self = extra;
    const config = { groupOn: (row: { department: string }) => row.department, groupRowRenderer: first, extra };

    await act(async () => root.render(<DataGrid rows={rows} groupingRows={config} />));
    await waitForRenderer(first);
    const grid = container.querySelector('tbw-grid') as DataGridElement;
    const plugin = grid.getPluginByName('groupingRows');
    config.groupRowRenderer = second;
    await act(async () => root.render(<DataGrid rows={rows} groupingRows={config} />));
    await waitForRenderer(second);
    expect(grid.getPluginByName('groupingRows')).toBe(plugin);

    await unmount(root, container);
  });

  it('reconfigures a feature when an unregistered callback changes', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ department: 'Engineering', name: 'Alice' }];
    const byDepartment = (row: (typeof rows)[number]) => row.department;
    const byName = (row: (typeof rows)[number]) => row.name;

    await act(async () => root.render(<DataGrid rows={rows} groupingRows={{ groupOn: byDepartment }} />));
    const grid = container.querySelector('tbw-grid') as DataGridElement;
    const plugin = grid.getPluginByName('groupingRows');
    await act(async () => root.render(<DataGrid rows={rows} groupingRows={{ groupOn: byName }} />));
    await act(async () => vi.waitFor(() => expect(container.textContent).toContain('Alice')));
    expect(grid.getPluginByName('groupingRows')).not.toBe(plugin);

    await unmount(root, container);
  });

  it.each([false, undefined])('removes the last feature when filtering becomes %s', async (disabled) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ name: 'Alice' }];

    await act(async () => {
      root.render(<DataGrid rows={rows} filtering />);
    });
    const grid = container.querySelector('tbw-grid') as DataGridElement;
    await vi.waitFor(() => expect(grid.getPluginByName('filtering')).toBeDefined());

    await act(async () => {
      root.render(<DataGrid rows={rows} filtering={disabled} />);
    });
    await vi.waitFor(() => expect(grid.getPluginByName('filtering')).toBeUndefined());

    await act(async () => root.unmount());
    container.remove();
  });

  it('preserves the base config and another feature when filtering is disabled and re-enabled', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rows = [{ name: 'Alice' }];
    const gridConfig = { rowHeight: 40 };
    const render = async (filtering: boolean) => {
      await act(async () => {
        root.render(<DataGrid rows={rows} gridConfig={gridConfig} selection="row" filtering={filtering} />);
      });
    };

    await render(true);
    const grid = container.querySelector('tbw-grid') as DataGridElement;
    await vi.waitFor(() => expect(grid.getPluginByName('filtering')).toBeDefined());
    await render(false);
    await vi.waitFor(() => expect(grid.getPluginByName('filtering')).toBeUndefined());
    expect(grid.getPluginByName('selection')).toBeDefined();
    expect(grid.gridConfig?.rowHeight).toBe(40);
    await render(true);
    await vi.waitFor(() => expect(grid.getPluginByName('filtering')).toBeDefined());
    expect(grid.getPluginByName('selection')).toBeDefined();

    await act(async () => root.unmount());
    container.remove();
  });
});

describe('DataGrid ref callback', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not re-assign gridConfig on parent re-render (regression)', async () => {
    // Spy on the gridConfig setter on the grid element prototype so we count how
    // many times the ref callback writes to it across renders.
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const gridConfig: GridConfig<Row> = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
      ],
    };
    const rows: Row[] = [{ id: 1, name: 'one' }];

    let setRenderToken!: (n: number) => void;
    function Wrapper() {
      const [renderToken, _setRenderToken] = useState(0);
      setRenderToken = _setRenderToken;
      // Pass an unstable style to simulate a parent that re-renders on resize.
      return <DataGrid<Row> rows={rows} gridConfig={gridConfig} style={{ height: 400 + renderToken }} />;
    }

    await act(async () => {
      root.render(<Wrapper />);
    });

    const gridEl = container.querySelector('tbw-grid') as DataGridElement | null;
    expect(gridEl).toBeTruthy();

    // Wrap the gridConfig setter to count writes from this point forward.
    // The initial mount has already happened; we're measuring re-render writes.
    let configWriteCount = 0;
    const proto = Object.getPrototypeOf(gridEl);
    const desc = Object.getOwnPropertyDescriptor(proto, 'gridConfig');
    expect(desc?.set).toBeTypeOf('function');
    const originalSet = desc!.set!;
    Object.defineProperty(gridEl!, 'gridConfig', {
      configurable: true,
      get: desc!.get,
      set(value) {
        configWriteCount++;
        originalSet.call(this, value);
      },
    });

    // Trigger several parent re-renders without changing gridConfig.
    await act(async () => {
      setRenderToken(1);
    });
    await act(async () => {
      setRenderToken(2);
    });
    await act(async () => {
      setRenderToken(3);
    });

    // The dedicated useEffect that syncs gridConfig only runs when
    // processedGridConfig changes (memoized on gridConfig identity), so
    // re-rendering with the same gridConfig must not re-write the setter.
    expect(configWriteCount).toBe(0);

    await act(async () => {
      root.unmount();
    });
  });
});

/**
 * Smart row diffing: when `getRowId` is configured and only values changed
 * (same count, same IDs, same order), the adapter routes through
 * `el.updateRows(..., 'sync')` instead of reassigning `el.rows`. Structural
 * changes (add / remove / reorder) fall back to the full `el.rows` replace.
 */
describe('DataGrid smart row diffing', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  async function mountWithSpies(initial: Row[]) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    // Stable config so re-renders don't re-process gridConfig.
    const gridConfig: GridConfig<Row> = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
      ],
      getRowId: (r) => String(r.id),
    };

    let setRows!: (r: Row[]) => void;
    function Wrapper() {
      const [rows, _setRows] = useState<Row[]>(initial);
      setRows = _setRows;
      return <DataGrid<Row> rows={rows} gridConfig={gridConfig} />;
    }
    await act(async () => {
      root.render(<Wrapper />);
    });

    const gridEl = container.querySelector('tbw-grid') as DataGridElement<Row>;
    expect(gridEl).toBeTruthy();

    // Record updateRows() calls (do not call through — we only assert routing).
    const updateRowsCalls: Array<[unknown, unknown]> = [];
    (gridEl as unknown as { updateRows: unknown }).updateRows = (updates: unknown, source?: unknown) => {
      updateRowsCalls.push([updates, source]);
    };

    // Count writes to the `rows` setter from this point (post-mount).
    let rowsSetCount = 0;
    const proto = Object.getPrototypeOf(gridEl);
    const desc = Object.getOwnPropertyDescriptor(proto, 'rows')!;
    Object.defineProperty(gridEl, 'rows', {
      configurable: true,
      get: desc.get,
      set(value) {
        rowsSetCount++;
        desc.set!.call(this, value);
      },
    });

    return {
      updateRowsCalls,
      getRowsSetCount: () => rowsSetCount,
      setRows: (r: Row[]) => act(async () => setRows(r)),
      unmount: () => act(async () => root.unmount()),
    };
  }

  it("routes a value-only change through el.updateRows(..., 'sync') without reassigning el.rows", async () => {
    const h = await mountWithSpies([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);

    // Same ids, same order, same length — only a value changed (new identities).
    await h.setRows([
      { id: 1, name: 'A' },
      { id: 2, name: 'b' },
    ]);

    expect(h.updateRowsCalls.length).toBe(1);
    expect(h.updateRowsCalls[0][1]).toBe('sync');
    expect(h.getRowsSetCount()).toBe(0);

    await h.unmount();
  });

  it('falls back to el.rows assignment for a structural change (reorder)', async () => {
    const h = await mountWithSpies([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);

    // Same ids/length but reordered → structural → full replace.
    await h.setRows([
      { id: 2, name: 'b' },
      { id: 1, name: 'a' },
    ]);

    expect(h.updateRowsCalls.length).toBe(0);
    expect(h.getRowsSetCount()).toBeGreaterThan(0);

    await h.unmount();
  });

  it('falls back to el.rows assignment when a row is added', async () => {
    const h = await mountWithSpies([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);

    await h.setRows([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 3, name: 'c' },
    ]);

    expect(h.updateRowsCalls.length).toBe(0);
    expect(h.getRowsSetCount()).toBeGreaterThan(0);

    await h.unmount();
  });
});

describe('DataGrid cell loading renderer lifecycle', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('preserves a React loading renderer while a React cell renderer is released for editing', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let loadingUnmounts = 0;

    function LoadingProbe({ size }: { size: 'large' | 'small' }) {
      useEffect(
        () => () => {
          loadingUnmounts++;
        },
        [],
      );
      return <span className="react-loading-probe">{size}</span>;
    }

    const editingPlugin = new EditingPlugin({ editOn: 'manual' });
    const gridConfig: ReactGridConfig<Row> = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name', editable: true, renderer: () => <span>Cell</span> },
      ],
      getRowId: (row) => String(row.id),
      plugins: [editingPlugin],
      loadingRenderer: ({ size }) => <LoadingProbe size={size} />,
    };

    await act(async () => {
      root.render(<DataGrid<Row> rows={[{ id: 1, name: 'Alpha' }]} gridConfig={gridConfig} />);
    });

    const grid = container.querySelector('tbw-grid') as DataGridElement<Row>;
    await act(async () => {
      await grid.ready();
    });

    const nameCell = grid.querySelector('.data-grid-row .cell[data-col="1"]') as HTMLElement;
    await act(async () => {
      grid.setCellLoading('1', 'name', true);
      await Promise.resolve();
    });
    const loadingOverlay = nameCell.querySelector(':scope > .tbw-cell-loading-overlay');
    await vi.waitFor(() => {
      expect(loadingOverlay?.querySelector('.react-loading-probe')?.textContent).toBe('small');
    });

    act(() => editingPlugin.beginCellEdit(0, 'name'));

    expect(loadingUnmounts).toBe(0);
    expect(nameCell.querySelector('.tbw-editor-host')).not.toBeNull();
    expect(nameCell.querySelector(':scope > .tbw-cell-loading-overlay')).toBe(loadingOverlay);
    expect(loadingOverlay?.querySelector('.react-loading-probe')?.textContent).toBe('small');

    // Closing the edit releases the editor through React's releaseCell; the loader must survive.
    await act(async () => {
      editingPlugin.cancelActiveRowEdit();
      await Promise.resolve();
    });

    const closedCell = grid.querySelector('.data-grid-row .cell[data-col="1"]') as HTMLElement;
    expect(closedCell.querySelector('.tbw-editor-host')).toBeNull();
    expect(loadingUnmounts).toBe(0);
    expect(closedCell.querySelector(':scope > .tbw-cell-loading-overlay')).toBe(loadingOverlay);
    expect(loadingOverlay?.querySelector('.react-loading-probe')?.textContent).toBe('small');

    act(() => grid.setCellLoading('1', 'name', false));
    expect(loadingUnmounts).toBe(1);

    await act(async () => {
      root.unmount();
    });
  });
});
