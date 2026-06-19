import { afterEach, describe, expect, it } from 'vitest';
import '../../core/grid';
import '../../features/context-menu';
import type { ContextMenuItem, ContextMenuParams } from './types';
import type { DataGridElement } from '../../core/grid';

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function settle(grid: DataGridElement): Promise<void> {
  await customElements.whenDefined('tbw-grid');
  if (typeof grid.ready === 'function') await grid.ready();
  await nextFrame();
  await nextFrame();
}

function openMenuOnFirstCell(grid: DataGridElement): string {
  document.querySelectorAll('.tbw-context-menu').forEach((m) => m.remove());
  const cell = grid.querySelector('[data-row][data-col]') as HTMLElement;
  cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
  return document.querySelector('.tbw-context-menu')?.textContent ?? '';
}

describe('context-menu — feature path config survives gridConfig re-resolution', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // Regression: a recomputed Angular `computed()` passes the SAME contextMenu
  // config object across re-resolutions. The feature-instance gate refreshes
  // the cached plugin's userConfig from the fresh sibling — which shared the
  // same object — and used to wipe it, falling back to the default Copy/Export
  // items. (#contextMenu)
  it('keeps configured items when gridConfig is re-set with the same config object', async () => {
    const contextMenuConfig = {
      items(_params: ContextMenuParams): ContextMenuItem[] {
        return [{ id: 'custom', name: 'Custom Item' }];
      },
    };

    const grid = document.createElement('tbw-grid') as DataGridElement;
    grid.gridConfig = {
      columns: [{ field: 'id', header: 'ID' }],
      features: { contextMenu: contextMenuConfig },
    };
    grid.rows = [{ id: 1 }];
    document.body.appendChild(grid);
    await settle(grid);

    expect(openMenuOnFirstCell(grid)).toContain('Custom Item');

    // Simulate the consumer's computed() re-running: a brand-new config object
    // with a new `features` reference, but the SAME contextMenuConfig instance.
    grid.gridConfig = {
      columns: [{ field: 'id', header: 'ID' }],
      features: { contextMenu: contextMenuConfig },
    };
    await settle(grid);

    const text = openMenuOnFirstCell(grid);
    expect(text).toContain('Custom Item');
    expect(text).not.toContain('Export');
  });
});
