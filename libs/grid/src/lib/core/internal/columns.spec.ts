import { afterEach, describe, expect, it } from 'vitest';
import { FitModeEnum } from '../types';
import { applyInitialOrder, autoSizeColumns, mergeColumns, parseLightDomColumns, updateTemplate } from './columns';
import { renderHeader } from './header';

describe('parseLightDomColumns', () => {
  it('parses attributes and boolean flags', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <tbw-grid-column field="id" type="number" header="ID" sortable resizable></tbw-grid-column>
      <tbw-grid-column field="name"></tbw-grid-column>
    `;
    const cols = parseLightDomColumns(host as any);
    const id = cols.find((c: any) => c.field === 'id');
    const name = cols.find((c: any) => c.field === 'name');
    expect(id).toMatchObject({ field: 'id', type: 'number', header: 'ID', sortable: true });
    expect(name).toMatchObject({ field: 'name' });
  });

  it('exposes the originating `<tbw-grid-column>` element via __element', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <tbw-grid-column field="id"></tbw-grid-column>
    `;
    const [col] = parseLightDomColumns(host as any);
    expect(col.__element).toBeInstanceOf(HTMLElement);
    expect(col.__element?.getAttribute('field')).toBe('id');
  });

  it('passes through any `type` string without an allowlist', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <tbw-grid-column field="rating" type="stars"></tbw-grid-column>
    `;
    const [col] = parseLightDomColumns(host as any);
    expect(col.type).toBe('stars');
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
    expect(col.__headerTemplate).toBeInstanceOf(HTMLElement);
    // The editor template is plugin-owned now — core only exposes __element;
    // the editing plugin reads <tbw-grid-column-editor> from it.
    expect(col.__editorTemplate).toBeUndefined();
    expect(col.__element?.querySelector('tbw-grid-column-editor')).toBeInstanceOf(HTMLElement);
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

  it('treats `attr="false"` as false for sortable and resizable', () => {
    // Vue's `:sortable="false"` serializes to `sortable="false"` on custom
    // elements, so `hasAttribute` alone would incorrectly treat the column
    // as sortable.
    const host = document.createElement('div');
    host.innerHTML = `
      <tbw-grid-column field="id" sortable="false" resizable="false"></tbw-grid-column>
    `;
    const [col] = parseLightDomColumns(host as any);
    expect(col.sortable).toBe(false);
    expect(col.resizable).toBeFalsy();
  });

  describe('framework adapter header hooks', () => {
    const original = (globalThis as any).DataGridElement;

    afterEach(() => {
      if (original === undefined) {
        delete (globalThis as any).DataGridElement;
      } else {
        (globalThis as any).DataGridElement = original;
      }
    });

    it('calls createHeaderRenderer / createHeaderLabelRenderer on the column element when adapter exposes them', () => {
      const calls: { kind: 'header' | 'headerLabel'; el: HTMLElement }[] = [];
      const headerFn = () => document.createElement('div');
      const headerLabelFn = () => document.createElement('span');

      const adapter = {
        canHandle: () => true,
        createRenderer: () => undefined,
        createEditor: () => undefined,
        createHeaderRenderer: (el: HTMLElement) => {
          calls.push({ kind: 'header', el });
          return headerFn;
        },
        createHeaderLabelRenderer: (el: HTMLElement) => {
          calls.push({ kind: 'headerLabel', el });
          return headerLabelFn;
        },
      };
      (globalThis as any).DataGridElement = { getAdapters: () => [adapter] };

      const host = document.createElement('div');
      host.innerHTML = `<tbw-grid-column field="x"></tbw-grid-column>`;
      const [col] = parseLightDomColumns(host as any);

      expect(col.headerRenderer).toBe(headerFn);
      expect(col.headerLabelRenderer).toBe(headerLabelFn);
      expect(calls.map((c) => c.kind)).toEqual(['header', 'headerLabel']);
      expect(calls[0].el.tagName.toLowerCase()).toBe('tbw-grid-column');
    });

    it('does not assign header(Label)Renderer when adapter returns undefined', () => {
      const adapter = {
        canHandle: () => true,
        createRenderer: () => undefined,
        createEditor: () => undefined,
        createHeaderRenderer: () => undefined,
        createHeaderLabelRenderer: () => undefined,
      };
      (globalThis as any).DataGridElement = { getAdapters: () => [adapter] };

      const host = document.createElement('div');
      host.innerHTML = `<tbw-grid-column field="x"></tbw-grid-column>`;
      const [col] = parseLightDomColumns(host as any);

      expect(col.headerRenderer).toBeUndefined();
      expect(col.headerLabelRenderer).toBeUndefined();
    });

    it('skips header hooks entirely when adapter omits them (back-compat)', () => {
      const adapter = {
        canHandle: () => true,
        createRenderer: () => undefined,
        createEditor: () => undefined,
      };
      (globalThis as any).DataGridElement = { getAdapters: () => [adapter] };

      const host = document.createElement('div');
      host.innerHTML = `<tbw-grid-column field="x"></tbw-grid-column>`;
      const [col] = parseLightDomColumns(host as any);

      expect(col.headerRenderer).toBeUndefined();
      expect(col.headerLabelRenderer).toBeUndefined();
    });
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

  it('propagates headerRenderer / headerLabelRenderer from DOM when programmatic has neither (mutually exclusive)', () => {
    const headerFn = () => document.createElement('div');
    const headerLabelFn = () => document.createElement('span');
    const programmatic: any = [
      { field: 'a' },
      { field: 'b', headerRenderer: () => document.createElement('em') },
      { field: 'c', headerLabelRenderer: () => document.createElement('em') },
      { field: 'd' },
    ];
    const dom: any = [
      // 'a': DOM supplies headerRenderer only -> picked
      { field: 'a', headerRenderer: headerFn },
      // 'b': programmatic already has headerRenderer -> DOM ignored
      { field: 'b', headerRenderer: headerFn },
      // 'c': programmatic already has headerLabelRenderer -> DOM headerRenderer ignored
      //      (renderHeader gives `headerRenderer` precedence, so promoting DOM here would
      //      silently shadow the programmatic label renderer).
      { field: 'c', headerRenderer: headerFn },
      // 'd': DOM supplies both -> headerRenderer wins (precedence in renderHeader)
      { field: 'd', headerRenderer: headerFn, headerLabelRenderer: headerLabelFn },
    ];
    const merged = mergeColumns(programmatic, dom);
    const a = merged.find((c: any) => c.field === 'a');
    const b = merged.find((c: any) => c.field === 'b');
    const c = merged.find((c: any) => c.field === 'c');
    const d = merged.find((c: any) => c.field === 'd');
    expect(a.headerRenderer).toBe(headerFn);
    expect(a.headerLabelRenderer).toBeUndefined();
    expect(b.headerRenderer).not.toBe(headerFn);
    expect(c.headerRenderer).toBeUndefined();
    expect(c.headerLabelRenderer).toBeDefined();
    expect(d.headerRenderer).toBe(headerFn);
    expect(d.headerLabelRenderer).toBeUndefined();
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

  it('updateTemplate preserves string widths (e.g. percentages) without appending px', () => {
    const g = makeGrid({
      columns: [
        { field: 'a', width: '30%' },
        { field: 'b', width: '20%' },
        { field: 'c', width: 40 },
      ],
    });
    updateTemplate(g);
    expect(g._gridTemplate).toBe('30% 20% 40px');
  });

  it('updateTemplate preserves string widths in fixed mode', () => {
    const g = makeGrid({
      columns: [{ field: 'a', width: '2fr' }, { field: 'b', width: 100 }, { field: 'c' }],
      fitMode: FitModeEnum.FIXED,
    });
    updateTemplate(g);
    expect(g._gridTemplate).toBe('2fr 100px max-content');
  });

  it('updateTemplate warns on invalid string width', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const g = makeGrid({ columns: [{ field: 'bad', width: 'banana' }] });
    updateTemplate(g);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("invalid CSS width value: 'banana'"));
    // The value is still used (passed through) so CSS can reject it
    expect(g._gridTemplate).toBe('banana');
    warnSpy.mockRestore();
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

describe('applyInitialOrder', () => {
  it('reorders columns with explicit order values', () => {
    const cols: any = [{ field: 'a' }, { field: 'b', order: 0 }, { field: 'c' }];
    applyInitialOrder(cols);
    expect(cols.map((c: any) => c.field)).toEqual(['b', 'a', 'c']);
  });

  it('returns unchanged when no columns have order', () => {
    const cols: any = [{ field: 'a' }, { field: 'b' }, { field: 'c' }];
    applyInitialOrder(cols);
    expect(cols.map((c: any) => c.field)).toEqual(['a', 'b', 'c']);
  });

  it('handles multiple ordered columns', () => {
    const cols: any = [{ field: 'a' }, { field: 'b', order: 1 }, { field: 'c', order: 0 }, { field: 'd' }];
    applyInitialOrder(cols);
    expect(cols.map((c: any) => c.field)).toEqual(['c', 'b', 'a', 'd']);
  });

  it('handles order values that are out of bounds', () => {
    const cols: any = [{ field: 'a', order: 5 }, { field: 'b' }, { field: 'c' }];
    applyInitialOrder(cols);
    // Ordered column 'a' should still be placed at its index
    expect(cols.length).toBe(3);
  });

  it('mutates array in-place', () => {
    const cols: any = [{ field: 'a' }, { field: 'b', order: 0 }, { field: 'c' }];
    const result = applyInitialOrder(cols);
    expect(result).toBe(cols); // Should return the same array reference
  });

  it('preserves unordered column relative order', () => {
    const cols: any = [{ field: 'a' }, { field: 'b', order: 2 }, { field: 'c' }, { field: 'd' }];
    applyInitialOrder(cols);
    // Unordered columns (a, c, d) should stay in relative order
    // b goes to index 2: a, c, b, d
    expect(cols.map((c: any) => c.field)).toEqual(['a', 'c', 'b', 'd']);
  });
});
