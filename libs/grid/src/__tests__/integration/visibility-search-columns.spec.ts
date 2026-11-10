/**
 * Integration tests: the opt-in Visibility panel search (#651) must survive a
 * real `grid.columns = [...]` assignment while it has focus. A column change
 * re-merges config, and ShellPlugin re-collects plugin tool panels on every
 * merge (cleanup + re-render), so the panel content is rebuilt.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { nextFrame, waitUpgrade } from '../../../test/helpers';
import '../../index';
import type { DataGridElement } from '../../lib/core/grid';
import { ShellPlugin } from '../../lib/plugins/shell/shell-plugin';
import { VisibilityPlugin } from '../../lib/plugins/visibility/visibility-plugin';

interface Row {
  id: string;
  name: string;
  city: string;
}

async function mountPanel(root: Node = document.body) {
  const grid = document.createElement('tbw-grid') as DataGridElement<Row>;
  root.appendChild(grid);
  const shell = new ShellPlugin({ toolPanel: { mode: 'overlay' } });
  grid.gridConfig = {
    getRowId: (row) => row.id,
    columns: [
      { field: 'name', header: 'Name' },
      { field: 'city', header: 'City' },
    ],
    plugins: [shell, new VisibilityPlugin({ searchable: true })],
  };
  grid.rows = [{ id: '1', name: 'Alice', city: 'Oslo' }];
  await waitUpgrade(grid);
  shell.openToolPanel('columns');
  await nextFrame();
  const search = () => grid.querySelector<HTMLInputElement>('input[type="search"]')!;
  return { grid, shell, search };
}

async function typeThenReassignColumns(grid: DataGridElement<Row>, search: HTMLInputElement) {
  search.focus();
  search.value = 'nam';
  search.dispatchEvent(new InputEvent('input'));
  search.setSelectionRange(1, 2);
  grid.columns = [
    { field: 'name', header: 'Name' },
    { field: 'city', header: 'City' },
    { field: 'nameAlt', header: 'Name alt' },
  ];
  await waitUpgrade(grid);
  await nextFrame();
}

describe('Visibility search across column assignments (#651)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps search focus, caret, and query when columns are reassigned', async () => {
    const { grid, search } = await mountPanel();
    await typeThenReassignColumns(grid, search());

    const after = search();
    expect(after.value).toBe('nam');
    expect(document.activeElement).toBe(after);
    expect([after.selectionStart, after.selectionEnd]).toEqual([1, 2]);
    const fields = [...grid.querySelectorAll<HTMLElement>('.tbw-visibility-row')].map((r) => r.dataset.field);
    expect(fields).toEqual(['name', 'nameAlt']);
  });

  it('restores focus for a grid inside a shadow root', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const { grid, search } = await mountPanel(shadow);
    // Browsers may leave the retargeted shadow host as `document.activeElement`
    // once the focused search is removed; happy-dom falls back to <body>.
    let proto: object | null = document;
    let descriptor: PropertyDescriptor | undefined;
    while (proto && !(descriptor = Object.getOwnPropertyDescriptor(proto, 'activeElement'))) {
      proto = Object.getPrototypeOf(proto);
    }
    const realActive = () => descriptor!.get!.call(document) as Element | null;
    const active = vi
      .spyOn(document, 'activeElement', 'get')
      .mockImplementation(() => (realActive() === document.body && !shadow.activeElement ? host : realActive()));
    try {
      await typeThenReassignColumns(grid, search());
    } finally {
      active.mockRestore();
    }

    expect(shadow.activeElement).toBe(search());
    expect([search().selectionStart, search().selectionEnd]).toEqual([1, 2]);
  });

  it('does not pull focus back into a search whose panel was closed', async () => {
    const { shell, search } = await mountPanel();
    search().focus();

    shell.closeToolPanel();
    (document.activeElement as HTMLElement | null)?.blur();
    shell.openToolPanel('columns');

    expect(search()).not.toBeNull();
    expect(document.activeElement).toBe(document.body);
  });
});
