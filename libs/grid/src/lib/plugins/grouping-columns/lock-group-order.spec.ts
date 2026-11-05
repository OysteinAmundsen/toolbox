/**
 * @vitest-environment happy-dom
 *
 * Tests for GroupingColumnsPlugin.lockGroupOrder feature.
 * Validates that column moves breaking group contiguity are prevented.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('GroupingColumnsPlugin.lockGroupOrder', async () => {
  const { GroupingColumnsPlugin } = await import('./grouping-columns-plugin');

  const groupedColumns = [
    { field: 'name', header: 'Name', group: { id: 'personal', label: 'Personal' } },
    { field: 'email', header: 'Email', group: { id: 'personal', label: 'Personal' } },
    { field: 'dept', header: 'Department', group: { id: 'work', label: 'Work' } },
    { field: 'title', header: 'Title', group: { id: 'work', label: 'Work' } },
    { field: 'notes', header: 'Notes' }, // ungrouped
  ];

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function createAttachedPlugin(
    config: { lockGroupOrder: boolean },
    columnOrder?: string[],
    columns = groupedColumns,
  ) {
    const plugin = new GroupingColumnsPlugin(config);
    const el = document.createElement('div');
    const abortController = new AbortController();
    const defaultOrder = columns.map((c) => c.field);
    const headerRow = document.createElement('div');
    headerRow.className = 'header-row';
    for (const column of columns) {
      const cell = document.createElement('div');
      cell.setAttribute('part', 'header-cell');
      cell.setAttribute('data-field', column.field);
      Object.defineProperty(cell, 'animate', { value: vi.fn(), configurable: true });
      headerRow.appendChild(cell);
    }
    el.appendChild(headerRow);
    const mockGrid = Object.assign(el, {
      _hostElement: el,
      effectiveConfig: { columns },
      gridConfig: {},
      getAllColumns: () => columns.map((c) => ({ ...c, visible: true })),
      getColumnOrder: () => columnOrder ?? defaultOrder,
      getPluginByName: () => null,
      query: () => [],
      queryPlugins: () => [],
      dispatchEvent: el.dispatchEvent.bind(el),
      disconnectSignal: abortController.signal,
    });
    plugin.attach(mockGrid as any);
    plugin.processColumns(columns);
    return { plugin, el, abortController, mockGrid };
  }

  function fireColumnMove(el: HTMLElement, field: string, columnOrder: string[]): boolean {
    const event = new CustomEvent('column-move', {
      detail: { field, fromIndex: 0, toIndex: 1, columnOrder },
      cancelable: true,
      bubbles: true,
    });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  }

  it('prevents moves that break group contiguity', () => {
    const { el } = createAttachedPlugin({ lockGroupOrder: true });

    // Move 'name' to after 'dept' — breaks personal group: [email, dept, name, title, notes]
    const prevented = fireColumnMove(el, 'name', ['email', 'dept', 'name', 'title', 'notes']);
    expect(prevented).toBe(true);
  });

  it('flashes a header for a quoted data-derived field when blocking a move', () => {
    const field = '24" monitor|c1';
    const columns = [
      { field, header: 'Monitor', group: { id: 'personal', label: 'Personal' } },
      { field: 'email', header: 'Email', group: { id: 'personal', label: 'Personal' } },
      { field: 'dept', header: 'Department', group: { id: 'work', label: 'Work' } },
      { field: 'title', header: 'Title', group: { id: 'work', label: 'Work' } },
      { field: 'notes', header: 'Notes' },
    ];
    const { el } = createAttachedPlugin({ lockGroupOrder: true }, undefined, columns);
    const headerCell = el.querySelector('.header-row [data-field]') as HTMLElement;
    const animate = vi.fn();
    Object.defineProperty(headerCell, 'animate', { value: animate, configurable: true });

    expect(fireColumnMove(el, field, ['email', 'dept', field, 'title', 'notes'])).toBe(true);
    expect(headerCell.getAttribute('data-field')).toBe(field);
    expect(animate).toHaveBeenCalled();
  });

  it('allows moves within the same group', () => {
    const { el } = createAttachedPlugin({ lockGroupOrder: true });

    // Swap name and email within personal group: [email, name, dept, title, notes]
    const prevented = fireColumnMove(el, 'name', ['email', 'name', 'dept', 'title', 'notes']);
    expect(prevented).toBe(false);
  });

  it('allows moves of ungrouped columns that do not break groups', () => {
    const { el } = createAttachedPlugin({ lockGroupOrder: true });

    // Move 'notes' to front: [notes, name, email, dept, title]
    const prevented = fireColumnMove(el, 'notes', ['notes', 'name', 'email', 'dept', 'title']);
    expect(prevented).toBe(false);
  });

  it('prevents ungrouped column from breaking another group', () => {
    const { el } = createAttachedPlugin({ lockGroupOrder: true });

    // Move 'notes' between 'name' and 'email': [name, notes, email, dept, title]
    const prevented = fireColumnMove(el, 'notes', ['name', 'notes', 'email', 'dept', 'title']);
    expect(prevented).toBe(true);
  });

  it('does not prevent moves when lockGroupOrder is false', () => {
    const { el } = createAttachedPlugin({ lockGroupOrder: false });

    // Move 'name' to after 'dept' — would break personal group
    const prevented = fireColumnMove(el, 'name', ['email', 'dept', 'name', 'title', 'notes']);
    expect(prevented).toBe(false);
  });

  it('does not prevent moves when no groups are active', () => {
    const plugin = new GroupingColumnsPlugin({ lockGroupOrder: true });
    const el = document.createElement('div');
    const abortController = new AbortController();
    const mockGrid = Object.assign(el, {
      _hostElement: el,
      effectiveConfig: { columns: [] },
      gridConfig: {},
      getAllColumns: () => [],
      getColumnOrder: () => [],
      getPluginByName: () => null,
      query: () => [],
      queryPlugins: () => [],
      dispatchEvent: el.dispatchEvent.bind(el),
      disconnectSignal: abortController.signal,
    });
    plugin.attach(mockGrid as any);
    // Don't call processColumns — groups remain empty (isActive = false)

    const prevented = fireColumnMove(el, 'name', ['email', 'dept', 'name']);
    expect(prevented).toBe(false);
  });

  describe('getColumnGrouping query reflects display order', () => {
    it('returns fields in original order when no reorder has occurred', () => {
      const { plugin } = createAttachedPlugin({ lockGroupOrder: false });

      const result = plugin.handleQuery({ type: 'getColumnGrouping', context: undefined }) as any[];
      const personal = result.find((g: any) => g.id === 'personal');
      const work = result.find((g: any) => g.id === 'work');

      expect(personal.fields).toEqual(['name', 'email']);
      expect(work.fields).toEqual(['dept', 'title']);
    });

    it('returns fields sorted by reordered display positions', () => {
      // Simulate a reorder: email before name, title before dept
      const reorderedOrder = ['email', 'name', 'title', 'dept', 'notes'];
      const { plugin } = createAttachedPlugin({ lockGroupOrder: false }, reorderedOrder);

      const result = plugin.handleQuery({ type: 'getColumnGrouping', context: undefined }) as any[];
      const personal = result.find((g: any) => g.id === 'personal');
      const work = result.find((g: any) => g.id === 'work');

      expect(personal.fields).toEqual(['email', 'name']);
      expect(work.fields).toEqual(['title', 'dept']);
    });

    it('returns fields sorted by display order with declarative columnGroups', () => {
      const plugin = new GroupingColumnsPlugin({ lockGroupOrder: false });
      const el = document.createElement('div');
      const abortController = new AbortController();
      const reorderedOrder = ['email', 'name', 'title', 'dept', 'notes'];
      const mockGrid = Object.assign(el, {
        _hostElement: el,
        effectiveConfig: { columns: groupedColumns },
        gridConfig: {
          columnGroups: [
            { id: 'personal', header: 'Personal', children: ['name', 'email'] },
            { id: 'work', header: 'Work', children: ['dept', 'title'] },
          ],
        },
        getAllColumns: () => groupedColumns.map((c) => ({ ...c, visible: true })),
        getColumnOrder: () => reorderedOrder,
        getPluginByName: () => null,
        query: () => [],
        queryPlugins: () => [],
        dispatchEvent: el.dispatchEvent.bind(el),
        disconnectSignal: abortController.signal,
      });
      plugin.attach(mockGrid as any);
      plugin.processColumns(groupedColumns);

      const result = plugin.handleQuery({ type: 'getColumnGrouping', context: undefined }) as any[];
      const personal = result.find((g: any) => g.id === 'personal');
      const work = result.find((g: any) => g.id === 'work');

      expect(personal.fields).toEqual(['email', 'name']);
      expect(work.fields).toEqual(['title', 'dept']);
    });
  });
});
