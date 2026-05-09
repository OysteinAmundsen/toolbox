import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../lib/core/grid';

// Import feature side-effect modules (registers factories in the registry)
import '../../lib/features/editing';
import '../../lib/features/filtering';
import '../../lib/features/multi-sort';
import '../../lib/features/selection';

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(r));
}

async function waitUpgrade(grid: any) {
  await customElements.whenDefined('tbw-grid');
  const start = Date.now();
  while (!grid.hasAttribute('data-upgraded')) {
    if (Date.now() - start > 3000) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  if (grid.ready) {
    try {
      await grid.ready();
    } catch {
      /* empty */
    }
  }
  if (grid.forceLayout) {
    try {
      await grid.forceLayout();
    } catch {
      /* empty */
    }
  }
  await nextFrame();
}

describe('gridConfig.features integration', () => {
  let grid: any;

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates plugins from features config', async () => {
    grid = document.createElement('tbw-grid');
    grid.gridConfig = {
      columns: [{ field: 'name' }],
      features: {
        selection: 'row',
        editing: 'dblclick',
      },
    };
    grid.rows = [{ name: 'Alice' }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    // Verify selection plugin is attached
    const selPlugin = grid.getPluginByName?.('selection');
    expect(selPlugin).toBeDefined();

    // Verify editing plugin is attached
    const editPlugin = grid.getPluginByName?.('editing');
    expect(editPlugin).toBeDefined();
  });

  it('features coexist with explicit plugins', async () => {
    const { MultiSortPlugin } = await import('../../lib/plugins/multi-sort');

    grid = document.createElement('tbw-grid');
    grid.gridConfig = {
      columns: [{ field: 'name' }],
      features: {
        selection: 'range',
      },
      plugins: [new MultiSortPlugin()],
    };
    grid.rows = [{ name: 'Alice' }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    // Both feature-derived and explicit plugins should be present
    expect(grid.getPluginByName?.('selection')).toBeDefined();
    expect(grid.getPluginByName?.('multiSort')).toBeDefined();
  });

  it('features: false disables a feature', async () => {
    grid = document.createElement('tbw-grid');
    grid.gridConfig = {
      columns: [{ field: 'name' }],
      features: {
        selection: 'row',
        editing: false,
      },
    };
    grid.rows = [{ name: 'Alice' }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    expect(grid.getPluginByName?.('selection')).toBeDefined();
    expect(grid.getPluginByName?.('editing')).toBeUndefined();
  });

  it('works without features (backward compat)', async () => {
    const { SelectionPlugin } = await import('../../lib/plugins/selection');

    grid = document.createElement('tbw-grid');
    grid.gridConfig = {
      columns: [{ field: 'name' }],
      plugins: [new SelectionPlugin({ mode: 'cell' })],
    };
    grid.rows = [{ name: 'Alice' }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    expect(grid.getPluginByName?.('selection')).toBeDefined();
  });

  it('dedups when same plugin appears in both features and plugins (manual wins)', async () => {
    const { SelectionPlugin } = await import('../../lib/plugins/selection');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const manualSelection = new SelectionPlugin({ mode: 'cell' });

    grid = document.createElement('tbw-grid');
    grid.gridConfig = {
      columns: [{ field: 'name' }],
      features: { selection: 'range' }, // would create another SelectionPlugin
      plugins: [manualSelection],
    };
    grid.rows = [{ name: 'Alice' }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    // Only one selection plugin attached, and it's the manual instance.
    expect(grid.getPluginByName?.('selection')).toBe(manualSelection);
    // No TBW023 multiple-instance warning emitted.
    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes('TBW023'))).toBe(false);

    warnSpy.mockRestore();
  });
});

describe('grid.on() typed event helper', () => {
  let grid: any;

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('subscribes to events and receives detail', async () => {
    grid = document.createElement('tbw-grid');
    grid.gridConfig = { columns: [{ field: 'name' }] };
    grid.rows = [{ name: 'Alice' }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    let receivedDetail: any;
    const off = grid.on('cell-click', (detail: any) => {
      receivedDetail = detail;
    });

    // Dispatch a synthetic cell-click event
    grid.dispatchEvent(new CustomEvent('cell-click', { detail: { field: 'name', value: 'Alice' }, bubbles: true }));

    expect(receivedDetail).toEqual({ field: 'name', value: 'Alice' });
    off();
  });

  it('returns an unsubscribe function', async () => {
    grid = document.createElement('tbw-grid');
    grid.gridConfig = { columns: [{ field: 'name' }] };
    grid.rows = [{ name: 'Alice' }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    let callCount = 0;
    const off = grid.on('cell-click', () => {
      callCount++;
    });

    grid.dispatchEvent(new CustomEvent('cell-click', { detail: {}, bubbles: true }));
    expect(callCount).toBe(1);

    off();

    grid.dispatchEvent(new CustomEvent('cell-click', { detail: {}, bubbles: true }));
    expect(callCount).toBe(1); // Should not increment after unsubscribe
  });

  it('provides raw event as second argument', async () => {
    grid = document.createElement('tbw-grid');
    grid.gridConfig = { columns: [{ field: 'name' }] };
    grid.rows = [{ name: 'Alice' }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    let rawEvent: any;
    const off = grid.on('cell-click', (_detail: any, event: any) => {
      rawEvent = event;
    });

    grid.dispatchEvent(new CustomEvent('cell-click', { detail: { field: 'name' }, bubbles: true }));

    expect(rawEvent).toBeInstanceOf(CustomEvent);
    expect(rawEvent.detail).toEqual({ field: 'name' });
    off();
  });
});
