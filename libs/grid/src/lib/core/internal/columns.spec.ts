import { describe, expect, it } from 'vitest';
import { FitModeEnum } from '../types';
import { autoSizeColumns, mergeColumns, parseLightDomColumns, updateTemplate } from './columns';
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

  it('parses options attribute for select columns', () => {
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

  it('parses width attribute as number', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <tbw-grid-column field="id" width="120"></tbw-grid-column>
    `;
    const [col] = parseLightDomColumns(host as any);
    expect(col.width).toBe(120);
  });

  it('parses width attribute with px suffix as string', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <tbw-grid-column field="id" width="120px"></tbw-grid-column>
    `;
    const [col] = parseLightDomColumns(host as any);
    expect(col.width).toBe('120px');
  });

  it('parses minWidth attribute (camelCase)', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <tbw-grid-column field="id" minWidth="80"></tbw-grid-column>
    `;
    const [col] = parseLightDomColumns(host as any);
    expect(col.minWidth).toBe(80);
  });

  it('parses min-width attribute (kebab-case)', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <tbw-grid-column field="id" min-width="80"></tbw-grid-column>
    `;
    const [col] = parseLightDomColumns(host as any);
    expect(col.minWidth).toBe(80);
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

  it('merges width and minWidth from DOM when not set programmatically', () => {
    const programmatic: any = [
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B', width: 200 },
    ];
    const dom: any = [
      { field: 'a', width: 120, minWidth: 80 },
      { field: 'b', width: 100, minWidth: 50 },
    ];
    const merged = mergeColumns(programmatic, dom);
    const a = merged.find((c: any) => c.field === 'a');
    const b = merged.find((c: any) => c.field === 'b');
    // DOM width/minWidth should be applied when programmatic is missing
    expect(a).toMatchObject({ field: 'a', width: 120, minWidth: 80 });
    // Programmatic width should be preserved, but minWidth from DOM should be applied
    expect(b).toMatchObject({ field: 'b', width: 200, minWidth: 50 });
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
      effectiveConfig: opts,
    };
    return grid;
  }

  it('updateTemplate assigns template string in stretch mode', () => {
    const g = makeGrid();
    updateTemplate(g);
    expect(typeof g._gridTemplate).toBe('string');
    // Count occurrences of '1fr' to determine column count
    const frCount = (g._gridTemplate.match(/1fr/g) || []).length;
    expect(frCount).toBe(g._columns.length);
  });

  it('updateTemplate uses minmax when minWidth specified', () => {
    const g = makeGrid({ columns: [{ field: 'a', minWidth: 100 }, { field: 'b' }] });
    updateTemplate(g);
    expect(g._gridTemplate).toBe('minmax(100px, 1fr) 1fr');
  });

  it('autoSizeColumns sets width when fit=stretch and not previously sized', () => {
    const g = makeGrid({ fitMode: FitModeEnum.STRETCH });
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
});
