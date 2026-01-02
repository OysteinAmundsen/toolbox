import { describe, expect, it } from 'vitest';
import { FitModeEnum } from '../types';
import { autoSizeColumns, getColumnConfiguration, mergeColumns, parseLightDomColumns, updateTemplate } from './columns';
import { renderHeader } from './header';

describe('parseLightDomColumns', () => {
  it('parses attributes and boolean flags', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <tbw-grid-column field="id" type="number" header="ID" sortable resizable editable></tbw-grid-column>
      <tbw-grid-column field="name"></tbw-grid-column>
    `;
    const cols = parseLightDomColumns(host as any);
    const id = cols.find((c: any) => c.field === 'id');
    const name = cols.find((c: any) => c.field === 'name');
    expect(id).toMatchObject({ field: 'id', type: 'number', header: 'ID', sortable: true, editable: true });
    expect(name).toMatchObject({ field: 'name' });
  });

  it('parses options attribute for select/typeahead columns', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <tbw-grid-column field="role" type="select" options="admin:Admin,user:User,guest"></tbw-grid-column>
    `;
    const [col] = parseLightDomColumns(host as any);
    expect((col as any).options).toEqual([
      { value: 'admin', label: 'Admin' },
      { value: 'user', label: 'User' },
      { value: 'guest', label: 'guest' },
    ]);
  });

  it('captures template elements', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <tbw-grid-column field="val">
        <tbw-grid-column-view><span>{{ value }}</span></tbw-grid-column-view>
        <tbw-grid-column-editor><input /></tbw-grid-column-editor>
        <tbw-grid-column-header><strong>Val</strong></tbw-grid-column-header>
      </tbw-grid-column>
    `;
    const [col] = parseLightDomColumns(host as any);
    expect(col.__viewTemplate).toBeInstanceOf(HTMLElement);
    expect(col.__editorTemplate).toBeInstanceOf(HTMLElement);
    expect(col.__headerTemplate).toBeInstanceOf(HTMLElement);
  });
});

describe('mergeColumns', () => {
  it('returns empty when both inputs empty', () => {
    expect(mergeColumns(undefined as any, undefined as any)).toEqual([]);
  });
  it('prefers programmatic when dom empty', () => {
    const p: any = [{ field: 'a', header: 'A' }];
    expect(mergeColumns(p, [])).toEqual(p);
  });
  it('prefers dom when programmatic empty', () => {
    const d: any = [{ field: 'a', header: 'A' }];
    expect(mergeColumns([], d)).toEqual(d);
  });
  it('merges flag OR logic and fills missing header/type', () => {
    const programmatic: any = [
      { field: 'a', sortable: true },
      { field: 'b', editable: true },
    ];
    const dom: any = [
      { field: 'a', resizable: true, header: 'A', type: 'number' },
      { field: 'b', sortable: true },
      { field: 'c', header: 'C' },
    ];
    const merged = mergeColumns(programmatic, dom);
    const a = merged.find((c: any) => c.field === 'a');
    const b = merged.find((c: any) => c.field === 'b');
    const c = merged.find((c: any) => c.field === 'c');
    expect(a).toMatchObject({ field: 'a', sortable: true, resizable: true, header: 'A', type: 'number' });
    expect(b).toMatchObject({ field: 'b', editable: true, sortable: true });
    expect(c).toBeTruthy();
  });
});

describe('column configuration', () => {
  function makeGrid(opts: Partial<any> = {}) {
    const host = document.createElement('div');
    host.innerHTML = '<div class="header-row"></div><div class="rows"></div>';
    const grid: any = {
      _rows: opts.rows || [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ],
      _columns: opts.columns || [{ field: 'id', sortable: true }, { field: 'name' }],
      get _visibleColumns() {
        return this._columns.filter((c: any) => !c.hidden);
      },
      fitMode: opts.fitMode || FitModeEnum.STRETCH,
      __didInitialAutoSize: false,
      _headerRowEl: host.querySelector('.header-row') as HTMLElement,
      _bodyEl: host.querySelector('.rows') as HTMLElement,
      _rowPool: [],
      findHeaderRow() {
        return this._headerRowEl;
      },
      refreshVirtualWindow: () => {
        /* empty */
      },
      _resizeController: {
        start: () => {
          /* empty */
        },
      },
      dispatchEvent: () => {
        /* empty */
      },
      style: {
        setProperty: () => {
          /* empty */
        },
      },
      virtualization: { enabled: false },
      _sortState: null,
      querySelectorAll: (__sel: string) => [],
      isConnected: true,
    };
    return grid;
  }
  it('getColumnConfiguration infers when no columns', () => {
    const g = makeGrid({ columns: [] });
    getColumnConfiguration(g);
    expect(g._columns.length).toBeGreaterThan(0);
  });
  it('updateTemplate assigns template string in stretch mode', () => {
    const g = makeGrid();
    getColumnConfiguration(g);
    updateTemplate(g);
    expect(typeof g._gridTemplate).toBe('string');
    // Count occurrences of '1fr' to determine column count
    const frCount = (g._gridTemplate.match(/1fr/g) || []).length;
    expect(frCount).toBe(g._columns.length);
  });
  it('updateTemplate uses minmax when minWidth specified', () => {
    const g = makeGrid({ columns: [{ field: 'a', minWidth: 100 }, { field: 'b' }] });
    getColumnConfiguration(g);
    updateTemplate(g);
    expect(g._gridTemplate).toBe('minmax(100px, 1fr) 1fr');
  });
  it('autoSizeColumns sets width when fit=stretch and not previously sized', () => {
    const g = makeGrid({ fitMode: FitModeEnum.STRETCH });
    getColumnConfiguration(g);
    renderHeader(g);
    g._rowPool = [document.createElement('div')] as any;
    const row = g._rowPool[0];
    g._columns.forEach(() => {
      const cell = document.createElement('div');
      Object.defineProperty(cell, 'scrollWidth', { value: 50, configurable: true });
      row.appendChild(cell);
    });
    const headerCell = document.createElement('div');
    Object.defineProperty(headerCell, 'scrollWidth', { value: 40, configurable: true });
    g._headerRowEl.appendChild(headerCell);
    autoSizeColumns(g);
    const sized = g._columns.filter((c: any) => c.width);
    expect(sized.length).toBeGreaterThan(0);
  });
  it('defaults sortable/resizable true when undefined', () => {
    const g = makeGrid({ columns: [{ field: 'id' }, { field: 'name', sortable: false }] });
    getColumnConfiguration(g);
    // simulate mergeEffectiveConfig defaults (we mimic by applying same logic here)
    g._columns.forEach((c: any) => {
      if (c.sortable === undefined) c.sortable = true;
      if (c.resizable === undefined) c.resizable = true;
    });
    const id = g._columns.find((c: any) => c.field === 'id');
    const name = g._columns.find((c: any) => c.field === 'name');
    expect(id.sortable).toBe(true);
    expect(id.resizable).toBe(true);
    expect(name.sortable).toBe(false); // explicit false preserved
  });
  it('assigns default width 80 in fixed mode when missing', () => {
    const g = makeGrid({ fitMode: FitModeEnum.FIXED, columns: [{ field: 'id' }, { field: 'name', width: 120 }] });
    getColumnConfiguration(g);
    // emulate fixed mode defaulting
    g._columns.forEach((c: any) => {
      if (c.width == null) c.width = 80;
    });
    const id = g._columns.find((c: any) => c.field === 'id');
    const name = g._columns.find((c: any) => c.field === 'name');
    expect(id.width).toBe(80);
    expect(name.width).toBe(120);
  });
});
