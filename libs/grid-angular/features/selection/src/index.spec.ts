/**
 * Tests for injectGridSelection – selectAll delegation and array-mode signal sync (#489).
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockElementRef = { nativeElement: document.createElement('div') };
const mockDestroyRef = { onDestroy: vi.fn() };
let mockAfterNextRender: (() => void) | null = null;

vi.mock('@angular/core', () => ({
  ElementRef: { name: 'ElementRef' },
  DestroyRef: { name: 'DestroyRef' },
  inject: vi.fn((token: { name?: string }) => (token?.name === 'ElementRef' ? mockElementRef : mockDestroyRef)),
  signal: <T>(initial: T) => {
    let value = initial;
    const sig = Object.assign(() => value, {
      set: (next: T) => {
        value = next;
      },
      asReadonly: () => sig,
    });
    return sig;
  },
  afterNextRender: vi.fn((cb: () => void) => {
    mockAfterNextRender = cb;
  }),
}));
vi.mock('@toolbox-web/grid/features/selection', () => ({}));
vi.mock('@toolbox-web/grid/plugins/selection', () => ({ SelectionPlugin: class SelectionPlugin {} }));
vi.mock('./grid-selection.directive', () => ({ GridSelectionDirective: class GridSelectionDirective {} }));

const { injectGridSelection } = await import('./index.js');

type Mode = 'row' | 'range' | ('row' | 'range' | 'column')[];

function setup(mode: Mode) {
  const plugin = {
    config: { mode },
    selectAll: vi.fn(),
    getSelection: vi.fn().mockReturnValue({ ranges: [] }),
    getSelectedRowIndices: vi.fn().mockReturnValue([0, 2]),
    getSelectedRows: vi.fn().mockReturnValue([{ id: 1 }, { id: 3 }]),
  };
  const listeners = new Map<string, (detail: unknown) => void>();
  const grid = document.createElement('tbw-grid');
  Object.assign(grid, {
    getPluginByName: (name: string) => (name === 'selection' ? plugin : undefined),
    ready: () => Promise.resolve(),
    on: (type: string, listener: (detail: unknown) => void) => {
      listeners.set(type, listener);
      return () => listeners.delete(type);
    },
  });
  mockElementRef.nativeElement = document.createElement('div');
  mockElementRef.nativeElement.appendChild(grid);
  return { plugin, emit: (type: string, detail: unknown) => listeners.get(type)?.(detail) };
}

describe('injectGridSelection', () => {
  beforeEach(() => {
    mockAfterNextRender = null;
  });

  it('selectAll delegates to SelectionPlugin.selectAll', () => {
    const { plugin } = setup(['row', 'column']);
    const api = injectGridSelection();

    api.selectAll();

    expect(plugin.selectAll).toHaveBeenCalledTimes(1);
  });

  it('selectedRowIndices tracks row selection for array modes on selection-change', () => {
    const { emit } = setup(['row', 'column']);
    const api = injectGridSelection();
    api.selectAll(); // discovers the grid and attaches the listener

    emit('selection-change', { mode: ['row', 'column'] });

    expect(api.selectedRowIndices()).toEqual([0, 2]);
    expect(api.selectedRows()).toEqual([{ id: 1 }, { id: 3 }]);
  });

  it('selectedRowIndices stays empty for range modes', () => {
    const { emit } = setup(['range', 'column']);
    const api = injectGridSelection();
    api.selectAll();

    emit('selection-change', { mode: ['range', 'column'] });

    expect(api.selectedRowIndices()).toEqual([]);
  });

  it('initial sync resolves array modes from the plugin config', async () => {
    setup(['row', 'column']);
    const api = injectGridSelection();

    mockAfterNextRender?.();

    await vi.waitFor(() => expect(api.selectedRowIndices()).toEqual([0, 2]));
  });
});
