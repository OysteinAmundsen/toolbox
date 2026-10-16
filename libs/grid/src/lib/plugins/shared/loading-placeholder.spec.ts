import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FrameworkAdapter, GridHost, RowElementInternal } from '../../core/types';
import { PLACEHOLDER_ROW_CLASS, renderLoadingPlaceholderRow } from './loading-placeholder';

function host(adapter?: Partial<FrameworkAdapter>, pluginHeight?: (row: unknown, index: number) => number | undefined) {
  const el = document.createElement('div') as HTMLElement & {
    __frameworkAdapter?: Partial<FrameworkAdapter>;
    _getPluginRowHeight?: (row: unknown, index: number) => number | undefined;
  };
  el.__frameworkAdapter = adapter;
  if (pluginHeight) el._getPluginRowHeight = pluginHeight;
  return el as GridHost;
}

function loadedRow(): RowElementInternal {
  const row: RowElementInternal = document.createElement('div');
  row.className = 'data-grid-row group-row stale';
  row.innerHTML =
    '<div class="cell"><span data-portal>a</span></div><div class="cell"><span data-portal>b</span></div>';
  return row;
}

describe('renderLoadingPlaceholderRow', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('replaces the row with one full-width cell in the row-loading state', () => {
    const row = loadedRow();

    renderLoadingPlaceholderRow(host(), row, { __loading: true, __index: 0 }, 0);

    expect(row.className).toBe(`data-grid-row ${PLACEHOLDER_ROW_CLASS} tbw-row-loading`);
    expect(row.__isCustomRow).toBe(true);
    expect(row.getAttribute('aria-busy')).toBe('true');
    const cells = row.querySelectorAll('.cell');
    expect(cells.length).toBe(1);
    expect(cells[0].getAttribute('role')).toBe('gridcell');
    expect(row.querySelector('.tbw-row-loading-overlay .tbw-row-loading-spinner')).not.toBeNull();
  });

  it('releases the previous cells through the framework adapter inside a batch (PR #511)', () => {
    const calls: string[] = [];
    const adapter: Partial<FrameworkAdapter> = {
      beginBatch: vi.fn(() => calls.push('begin')),
      endBatch: vi.fn(() => calls.push('end')),
      releaseCell: vi.fn((cell: HTMLElement) => {
        // The adapter must still find its container inside the attached cell.
        calls.push(`release:${cell.querySelector('[data-portal]')?.textContent}:${cell.isConnected}`);
      }),
    };
    const grid = host(adapter);
    const row = loadedRow();
    document.body.appendChild(row);

    renderLoadingPlaceholderRow(grid, row, { __loading: true, __index: 3 }, 3);

    expect(calls).toEqual(['begin', 'release:b:true', 'release:a:true', 'end']);
    expect(adapter.beginBatch).toHaveBeenCalledWith(grid);
    expect(row.querySelectorAll('[data-portal]').length).toBe(0);
  });

  it('skips the rebuild when the same placeholder is rendered again', () => {
    const releaseCell = vi.fn();
    const grid = host({ releaseCell });
    const placeholder = { __loading: true, __index: 1 };
    const row = loadedRow();

    renderLoadingPlaceholderRow(grid, row, placeholder, 1);
    row.__rowDataRef = placeholder; // set by the core render loop after the hook
    const cell = row.querySelector('.cell');
    releaseCell.mockClear();

    renderLoadingPlaceholderRow(grid, row, placeholder, 1);

    expect(row.querySelector('.cell')).toBe(cell);
    expect(releaseCell).not.toHaveBeenCalled();
  });

  it('rebuilds when a different placeholder reuses the element', () => {
    const grid = host();
    const first = { __loading: true, __index: 1 };
    const row = loadedRow();
    renderLoadingPlaceholderRow(grid, row, first, 1);
    row.__rowDataRef = first;
    const cell = row.querySelector('.cell');

    renderLoadingPlaceholderRow(grid, row, { __loading: true, __index: 2 }, 2);

    expect(row.querySelector('.cell')).not.toBe(cell);
    expect(row.querySelectorAll('.tbw-row-loading-overlay').length).toBe(1);
  });

  // PR #511: the placeholder must occupy exactly the slot virtualization reserves for it.
  describe('row height', () => {
    it('drops a per-row --tbw-row-height override left by a recycled variable-height row', () => {
      const row = loadedRow();
      row.style.setProperty('--tbw-row-height', '70px');

      renderLoadingPlaceholderRow(host(), row, { __loading: true, __index: 4 }, 4);

      expect(row.style.getPropertyValue('--tbw-row-height')).toBe('');
      expect(row.style.height).toBe('');
    });

    it('drops a stale inline height (e.g. a recycled Responsive card) when no plugin reports one', () => {
      const row = loadedRow();
      row.style.height = '120px';

      renderLoadingPlaceholderRow(
        host(undefined, () => undefined),
        row,
        { __loading: true, __index: 4 },
        4,
      );

      expect(row.style.height).toBe('');
    });

    it('takes the height a plugin reports for the row, with the row index', () => {
      const pluginHeight = vi.fn((_row: unknown, _index: number) => 120);
      const placeholder = { __loading: true, __index: 9 };
      const row = loadedRow();

      renderLoadingPlaceholderRow(host(undefined, pluginHeight), row, placeholder, 9);

      expect(row.style.height).toBe('120px');
      expect(pluginHeight).toHaveBeenCalledWith(placeholder, 9);
    });

    it('re-syncs the height on a repeat render of the same placeholder (card height measured later)', () => {
      let reported = 80;
      const grid = host(undefined, () => reported);
      const placeholder = { __loading: true, __index: 1 };
      const row = loadedRow();
      renderLoadingPlaceholderRow(grid, row, placeholder, 1);
      row.__rowDataRef = placeholder;
      const cell = row.querySelector('.cell');

      reported = 132;
      renderLoadingPlaceholderRow(grid, row, placeholder, 1);

      expect(row.style.height).toBe('132px');
      expect(row.querySelector('.cell')).toBe(cell); // still no rebuild
    });
  });
});
