/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GridElement } from '../../core/plugin/base-plugin';
import type { ColumnReorderRequestDetail } from './types';
import { VisibilityPlugin } from './visibility-plugin';

function createGridMock(columns: any[] = []) {
  const gridEl = document.createElement('div');
  const abortCtrl = new AbortController();

  // Track column visibility state for the mock
  const hiddenColumns = new Set<string>();
  const expandedSections: string[] = [];
  let toolPanelOpen = false;

  // Shell tool-panel mock (#370). VisibilityPlugin resolves the shell via
  // `getPluginByName('shell')` and drives panel open/close/toggle through the
  // plugin instance — never the deprecated core `grid.*` shell delegates.
  const openToolPanel = vi.fn((_id?: string) => {
    toolPanelOpen = true;
  });
  const closeToolPanel = vi.fn(() => {
    toolPanelOpen = false;
  });
  const toggleToolPanelSection = vi.fn((id: string) => {
    const idx = expandedSections.indexOf(id);
    if (idx >= 0) expandedSections.splice(idx, 1);
    else expandedSections.push(id);
  });
  const shellMock = {
    openToolPanel,
    closeToolPanel,
    toggleToolPanelSection,
    get isToolPanelOpen() {
      return toolPanelOpen;
    },
    get expandedToolPanelSections() {
      return expandedSections;
    },
  };

  // Track whether the reorder plugin is "present" so the query mock can answer
  // `canMoveColumn` the way the real ReorderPlugin would. The shell plugin is
  // always resolvable (mirrors auto-registration).
  const getPluginByName = vi.fn((name?: string) => (name === 'shell' ? shellMock : undefined) as unknown);
  const reorderPresent = () => !!getPluginByName('reorder');

  const allColumnsProvider = () =>
    columns.map((c: any) => ({
      field: c.field,
      header: c.header ?? c.field,
      visible: !hiddenColumns.has(c.field) && c.visible !== false,
      lockVisible: c.lockVisible ?? c.meta?.lockVisibility ?? false,
      utility: c.utility ?? c.meta?.utility ?? false,
      meta: c.meta ?? {},
    }));

  gridEl.appendChild(document.createElement('div'));
  Object.defineProperty(gridEl, 'clientWidth', { value: 800 });
  return Object.assign(gridEl, {
    rows: [],
    sourceRows: [],
    columns,
    _visibleColumns: columns.filter((c: any) => !c.hidden),
    _hostElement: gridEl,
    gridConfig: {},
    effectiveConfig: {},
    getPlugin: vi.fn(() => undefined),
    getPluginByName,
    getPluginState: vi.fn(() => null),
    // Simulate the plugin query system. When ReorderPlugin is "present" (via
    // getPluginByName mock), answer `canMoveColumn` the way ReorderPlugin would:
    // honoring top-level `lockPosition`, legacy `meta.lockPosition`, and
    // `meta.suppressMovable`.
    query: vi.fn((type: string, ctx?: any): unknown[] => {
      if (type === 'canMoveColumn' && reorderPresent()) {
        const col = ctx ?? {};
        if (col.lockPosition === true) return [false];
        const meta = col.meta ?? {};
        if (meta.lockPosition === true || meta.suppressMovable === true) return [false];
        return [true];
      }
      return [];
    }),
    dispatchEvent: vi.spyOn(gridEl, 'dispatchEvent'),
    requestRender: vi.fn(),
    requestStateChange: vi.fn(),
    disconnectSignal: abortCtrl.signal,
    _abortCtrl: abortCtrl,

    // Column visibility API that VisibilityPlugin delegates to
    isColumnVisible: vi.fn((field: string) => !hiddenColumns.has(field)),
    setColumnVisible: vi.fn((field: string, visible: boolean) => {
      if (visible) hiddenColumns.delete(field);
      else hiddenColumns.add(field);
    }),
    toggleColumnVisibility: vi.fn((field: string) => {
      if (hiddenColumns.has(field)) hiddenColumns.delete(field);
      else hiddenColumns.add(field);
    }),
    showAllColumns: vi.fn(() => hiddenColumns.clear()),
    getAllColumns: vi.fn(allColumnsProvider),
    setColumnOrder: vi.fn(),

    // Tool panel API — the same vi.fn instances exposed via the shell mock, so
    // tests can assert on either `grid.getPluginByName('shell').openToolPanel`
    // or the shared `openToolPanel`/`closeToolPanel`/`toggleToolPanelSection`.
    get isToolPanelOpen() {
      return toolPanelOpen;
    },
    openToolPanel,
    closeToolPanel,
    get expandedToolPanelSections() {
      return expandedSections;
    },
    toggleToolPanelSection,

    // Hidden columns state (for test introspection)
    _hiddenColumns: hiddenColumns,
    _expandedSections: expandedSections,
    _setToolPanelOpen: (v: boolean) => {
      toolPanelOpen = v;
    },
  });
}

describe('VisibilityPlugin', () => {
  let plugin: VisibilityPlugin;
  let grid: ReturnType<typeof createGridMock>;

  const defaultColumns = [
    { field: 'name', header: 'Name' },
    { field: 'age', header: 'Age' },
    { field: 'city', header: 'City' },
  ];

  beforeEach(() => {
    plugin = new VisibilityPlugin();
    grid = createGridMock(defaultColumns);
    plugin.attach(grid as any);
  });

  afterEach(() => {
    grid._abortCtrl.abort();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // #region Constructor & Metadata

  describe('constructor & metadata', () => {
    it('should have name "visibility"', () => {
      expect(plugin.name).toBe('visibility');
    });

    it('should have PANEL_ID "columns"', () => {
      expect(VisibilityPlugin.PANEL_ID).toBe('columns');
    });

    it('should declare optional dependency on reorder plugin', () => {
      expect(VisibilityPlugin.dependencies).toEqual([
        { name: 'shell', required: true, reason: expect.any(String) },
        { name: 'reorder', required: false, reason: expect.any(String) },
      ]);
    });

    it('should declare manifest with getContextMenuItems query', () => {
      expect(VisibilityPlugin.manifest.queries).toEqual([
        { type: 'getContextMenuItems', description: expect.any(String) },
      ]);
    });
  });

  // #endregion

  // #region processColumns - declarative attributes (issue #272)

  describe('processColumns', () => {
    const makeColEl = (attrs: Record<string, string>) => {
      const el = document.createElement('tbw-grid-column');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      return el;
    };

    it('reads the `hidden` attribute from __element', () => {
      const cols = [{ field: 'a', __element: makeColEl({ hidden: '' }) }] as any;
      const result = plugin.processColumns(cols);
      expect((result[0] as any).hidden).toBe(true);
    });

    it('treats `hidden="false"` as not hidden', () => {
      const cols = [{ field: 'a', __element: makeColEl({ hidden: 'false' }) }] as any;
      const result = plugin.processColumns(cols);
      expect((result[0] as any).hidden).toBeUndefined();
    });

    it('reads the `lock-visible` attribute from __element', () => {
      const cols = [{ field: 'a', __element: makeColEl({ 'lock-visible': '' }) }] as any;
      const result = plugin.processColumns(cols);
      expect((result[0] as any).lockVisible).toBe(true);
    });

    it('does not clobber a runtime-set visibility state (config wins)', () => {
      // setColumnVisible writes col.hidden = false; the attribute must not override it.
      const cols = [{ field: 'a', hidden: false, __element: makeColEl({ hidden: '' }) }] as any;
      const result = plugin.processColumns(cols);
      expect((result[0] as any).hidden).toBe(false);
    });

    it('leaves columns without __element untouched', () => {
      const cols = [{ field: 'a' }] as any;
      const result = plugin.processColumns(cols);
      expect((result[0] as any).hidden).toBeUndefined();
    });
  });

  // #endregion

  // #region Public API - isColumnVisible

  describe('isColumnVisible', () => {
    it('should return true for visible columns', () => {
      expect(plugin.isColumnVisible('name')).toBe(true);
    });

    it('should return false for hidden columns', () => {
      grid._hiddenColumns.add('age');
      expect(plugin.isColumnVisible('age')).toBe(false);
    });

    it('should delegate to grid.isColumnVisible', () => {
      plugin.isColumnVisible('name');
      expect(grid.isColumnVisible).toHaveBeenCalledWith('name');
    });
  });

  // #endregion

  // #region Public API - setColumnVisible

  describe('setColumnVisible', () => {
    it('should show a column', () => {
      grid._hiddenColumns.add('age');
      plugin.setColumnVisible('age', true);
      expect(grid.setColumnVisible).toHaveBeenCalledWith('age', true);
    });

    it('should hide a column', () => {
      plugin.setColumnVisible('city', false);
      expect(grid.setColumnVisible).toHaveBeenCalledWith('city', false);
    });
  });

  // #endregion

  // #region Public API - getVisibleColumns

  describe('getVisibleColumns', () => {
    it('should return all fields when none are hidden', () => {
      const result = plugin.getVisibleColumns();
      expect(result).toEqual(['name', 'age', 'city']);
    });

    it('should exclude hidden columns', () => {
      grid._hiddenColumns.add('age');
      const result = plugin.getVisibleColumns();
      expect(result).toEqual(['name', 'city']);
    });
  });

  // #endregion

  // #region Public API - getHiddenColumns

  describe('getHiddenColumns', () => {
    it('should return empty array when all columns visible', () => {
      expect(plugin.getHiddenColumns()).toEqual([]);
    });

    it('should return hidden column fields', () => {
      grid._hiddenColumns.add('name');
      grid._hiddenColumns.add('city');
      expect(plugin.getHiddenColumns()).toEqual(['name', 'city']);
    });
  });

  // #endregion

  // #region Public API - showAll

  describe('showAll', () => {
    it('should delegate to grid.showAllColumns', () => {
      plugin.showAll();
      expect(grid.showAllColumns).toHaveBeenCalled();
    });
  });

  // #endregion

  // #region Public API - toggleColumn

  describe('toggleColumn', () => {
    it('should delegate to grid.toggleColumnVisibility', () => {
      plugin.toggleColumn('age');
      expect(grid.toggleColumnVisibility).toHaveBeenCalledWith('age');
    });
  });

  // #endregion

  // #region Public API - showColumn / hideColumn

  describe('showColumn', () => {
    it('should call setColumnVisible with true', () => {
      plugin.showColumn('city');
      expect(grid.setColumnVisible).toHaveBeenCalledWith('city', true);
    });
  });

  describe('hideColumn', () => {
    it('should call setColumnVisible with false', () => {
      plugin.hideColumn('name');
      expect(grid.setColumnVisible).toHaveBeenCalledWith('name', false);
    });
  });

  // #endregion

  // #region Public API - getAllColumns

  describe('getAllColumns', () => {
    it('should return all columns with visibility info', () => {
      const result = plugin.getAllColumns();
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(expect.objectContaining({ field: 'name', header: 'Name', visible: true }));
    });

    it('should reflect hidden state', () => {
      grid._hiddenColumns.add('age');
      const result = plugin.getAllColumns();
      const ageCol = result.find((c) => c.field === 'age');
      expect(ageCol?.visible).toBe(false);
    });

    it('should reflect lockVisible', () => {
      const g = createGridMock([
        { field: 'id', header: 'ID', lockVisible: true },
        { field: 'name', header: 'Name' },
      ]);
      const p = new VisibilityPlugin();
      p.attach(g as any);
      const result = p.getAllColumns();
      expect(result.find((c) => c.field === 'id')?.lockVisible).toBe(true);
    });
  });

  // #endregion

  // #region Panel Visibility

  describe('isPanelVisible', () => {
    it('should return false when tool panel is closed', () => {
      expect(plugin.isPanelVisible()).toBe(false);
    });

    it('should return false when panel is open but section not expanded', () => {
      grid._setToolPanelOpen(true);
      expect(plugin.isPanelVisible()).toBe(false);
    });

    it('should return true when panel is open and section expanded', () => {
      grid._setToolPanelOpen(true);
      grid._expandedSections.push('columns');
      expect(plugin.isPanelVisible()).toBe(true);
    });
  });

  // #endregion

  // #region show / hide / toggle panel

  describe('show', () => {
    it('should open tool panel with the visibility section expanded', () => {
      plugin.show();
      expect(grid.openToolPanel).toHaveBeenCalledWith('columns');
    });

    it('should still open with section id when already expanded (controller is idempotent)', () => {
      grid._expandedSections.push('columns');
      plugin.show();
      expect(grid.openToolPanel).toHaveBeenCalledWith('columns');
    });
  });

  describe('hide', () => {
    it('should close tool panel', () => {
      plugin.hide();
      expect(grid.closeToolPanel).toHaveBeenCalled();
    });
  });

  describe('toggle', () => {
    it('should open tool panel if closed, then toggle section', () => {
      plugin.toggle();
      expect(grid.openToolPanel).toHaveBeenCalled();
      expect(grid.toggleToolPanelSection).toHaveBeenCalledWith('columns');
    });

    it('should toggle section without opening if already open', () => {
      grid._setToolPanelOpen(true);
      plugin.toggle();
      expect(grid.openToolPanel).not.toHaveBeenCalled();
      expect(grid.toggleToolPanelSection).toHaveBeenCalledWith('columns');
    });
  });

  // #endregion

  // #region getToolPanel

  describe('getToolPanel', () => {
    it('should return a tool panel definition', () => {
      const panel = plugin.getToolPanel();
      expect(panel).toBeDefined();
      expect(panel!.id).toBe('columns');
      expect(panel!.title).toBe('Columns');
      expect(panel!.icon).toBe('☰');
      expect(panel!.tooltip).toBe('Column visibility');
      expect(panel!.order).toBe(100);
      expect(typeof panel!.render).toBe('function');
    });
  });

  // #endregion

  // #region renderPanelContent

  describe('renderPanelContent (via getToolPanel)', () => {
    it('should render column toggles into container', () => {
      const panel = plugin.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const wrapper = container.querySelector('.tbw-visibility-content');
      expect(wrapper).toBeDefined();

      const list = container.querySelector('.tbw-visibility-list');
      expect(list).toBeDefined();

      const rows = container.querySelectorAll('.tbw-visibility-row');
      expect(rows.length).toBe(3);
    });

    it('should render checkboxes for each column', () => {
      const panel = plugin.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(3);
      // All checked by default
      checkboxes.forEach((cb) => {
        expect((cb as HTMLInputElement).checked).toBe(true);
      });
    });

    it('should render unchecked checkboxes for hidden columns', () => {
      grid._hiddenColumns.add('age');
      const panel = plugin.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const rows = container.querySelectorAll('.tbw-visibility-row');
      const ageRow = Array.from(rows).find((r) => r.getAttribute('data-field') === 'age');
      expect(ageRow).toBeDefined();
      const cb = ageRow!.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(cb.checked).toBe(false);
    });

    it('should render disabled checkboxes for lockVisible columns', () => {
      const g = createGridMock([
        { field: 'id', header: 'ID', lockVisible: true },
        { field: 'name', header: 'Name' },
      ]);
      const p = new VisibilityPlugin();
      p.attach(g as any);

      const panel = p.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const idRow = container.querySelector('.tbw-visibility-row[data-field="id"]');
      expect(idRow).toBeDefined();
      expect(idRow!.classList.contains('locked')).toBe(true);
      const cb = idRow!.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(cb.disabled).toBe(true);
    });

    it('should render "Show All" button', () => {
      const panel = plugin.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const btn = container.querySelector('.tbw-visibility-show-all');
      expect(btn).toBeDefined();
      expect(btn!.textContent).toBe('Show All');
    });

    it('should call showAllColumns when "Show All" is clicked', () => {
      const panel = plugin.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const btn = container.querySelector('.tbw-visibility-show-all') as HTMLButtonElement;
      btn.click();
      expect(grid.showAllColumns).toHaveBeenCalled();
    });

    it('should return a cleanup function', () => {
      const panel = plugin.getToolPanel()!;
      const container = document.createElement('div');
      const cleanup = panel.render(container);

      expect(typeof cleanup).toBe('function');
      cleanup!();
      // Wrapper should be removed
      expect(container.querySelector('.tbw-visibility-content')).toBeNull();
    });

    it('should filter out utility columns', () => {
      const g = createGridMock([
        { field: '__expand', header: '', utility: true },
        { field: 'name', header: 'Name' },
        { field: 'age', header: 'Age' },
      ]);
      const p = new VisibilityPlugin();
      p.attach(g as any);

      const panel = p.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const rows = container.querySelectorAll('.tbw-visibility-row');
      expect(rows.length).toBe(2);
      const fields = Array.from(rows).map((r) => r.getAttribute('data-field'));
      expect(fields).toEqual(['name', 'age']);
    });

    it('should render column labels from header or field', () => {
      const g = createGridMock([
        { field: 'name', header: 'Full Name' },
        { field: 'email' }, // no header — fallback to field
      ]);
      const p = new VisibilityPlugin();
      p.attach(g as any);

      const panel = p.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const rows = container.querySelectorAll('.tbw-visibility-row');
      const labels = Array.from(rows).map((r) => r.querySelector('.tbw-visibility-label span')?.textContent);
      expect(labels).toEqual(['Full Name', 'email']);
    });
  });

  // #endregion

  describe('panel search', () => {
    const renderedFields = (container: HTMLElement) =>
      Array.from(container.querySelectorAll('.tbw-visibility-row'), (row) => row.getAttribute('data-field'));

    const searchFor = (container: HTMLElement, value: string) => {
      const input = container.querySelector<HTMLInputElement>('input[type="search"]')!;
      input.value = value;
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return input;
    };

    it.each([undefined, false])('does not render search when searchable is %s', (searchable) => {
      const panelPlugin = new VisibilityPlugin({ searchable });
      panelPlugin.attach(grid as GridElement);
      const container = document.createElement('div');
      panelPlugin.getToolPanel()!.render(container);
      expect(container.querySelector('input[type="search"]')).toBeNull();
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(renderedFields(container)).toEqual(['name', 'age', 'city']);
    });

    it('matches displayed labels case-insensitively without mutating grid state', () => {
      const panelPlugin = new VisibilityPlugin({ searchable: true });
      panelPlugin.attach(grid as GridElement);
      const container = document.createElement('div');
      panelPlugin.getToolPanel()!.render(container);
      const input = searchFor(container, '  nAM  ');
      expect(input.getAttribute('aria-label')).toBe('Search columns');
      expect(renderedFields(container)).toEqual(['name']);
      expect(grid.toggleColumnVisibility).not.toHaveBeenCalled();
      expect(grid.setColumnVisible).not.toHaveBeenCalled();
      expect(grid.setColumnOrder).not.toHaveBeenCalled();
      expect(grid.dispatchEvent).not.toHaveBeenCalled();
      searchFor(container, '  ');
      expect(renderedFields(container)).toEqual(['name', 'age', 'city']);
    });

    it('searches hidden columns and label fallbacks but excludes utility columns and hidden field aliases', () => {
      const columns = [
        { field: 'internalName', header: 'Full Name' },
        { field: 'email', header: '' },
        { field: 'utility', header: 'Email utility', utility: true },
      ];
      const panelGrid = createGridMock(columns);
      panelGrid._hiddenColumns.add('email');
      const panelPlugin = new VisibilityPlugin({ searchable: true });
      panelPlugin.attach(panelGrid as GridElement);
      const container = document.createElement('div');
      panelPlugin.getToolPanel()!.render(container);
      searchFor(container, 'email');
      expect(renderedFields(container)).toEqual(['email']);
      expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
      searchFor(container, 'internalName');
      expect(renderedFields(container)).toEqual([]);
      expect(container.querySelector('[role="status"]')!.textContent).toBe('No matching columns');
      searchFor(container, 'full');
      expect(renderedFields(container)).toEqual(['internalName']);
      expect(container.querySelector('[role="status"]')!.textContent).toBe('');
    });

    it('removes reorder controls while searching and restores them on clear', () => {
      grid.getPluginByName.mockImplementation(() => ({ moveColumn: vi.fn() }));
      const panelPlugin = new VisibilityPlugin({ searchable: true });
      panelPlugin.attach(grid as GridElement);
      const container = document.createElement('div');
      panelPlugin.getToolPanel()!.render(container);
      expect(container.querySelectorAll('.tbw-visibility-handle')).toHaveLength(3);
      searchFor(container, 'name');
      expect(renderedFields(container)).toEqual(['name']);
      expect(container.querySelector('.tbw-visibility-handle')).toBeNull();
      expect(container.querySelector('[draggable="true"]')).toBeNull();
      searchFor(container, '');
      expect(container.querySelectorAll('.tbw-visibility-handle')).toHaveLength(3);
    });

    it('keeps fragments separate and toggles only matching unlocked children', async () => {
      const panelGrid = createGridMock([
        { field: 'name', header: 'Contact name' },
        { field: 'locked', header: 'Contact ID', lockVisible: true },
        { field: 'age', header: 'Age' },
        { field: 'city', header: 'City' },
        { field: 'phone', header: 'Contact phone' },
      ]);
      panelGrid.query.mockImplementation((type) =>
        type === 'getColumnGrouping'
          ? [[{ id: 'contact', label: 'Personal details', fields: ['name', 'locked', 'age', 'phone'] }]]
          : [],
      );
      const panelPlugin = new VisibilityPlugin({ searchable: true });
      panelPlugin.attach(panelGrid as GridElement);
      const container = document.createElement('div');
      document.body.appendChild(container);
      panelPlugin.getToolPanel()!.render(container);
      searchFor(container, 'contact');
      expect(renderedFields(container)).toEqual(['name', 'locked', 'phone']);
      const groups = container.querySelectorAll('.tbw-visibility-group-header');
      expect(groups).toHaveLength(2);
      const groupCheckbox = groups[0].querySelector('input')!;
      groupCheckbox.click();
      expect(panelGrid.setColumnVisible.mock.calls).toEqual([['name', false]]);
      await vi.waitFor(() => {
        expect(container.querySelector<HTMLInputElement>('.tbw-visibility-group-header input')!.indeterminate).toBe(
          true,
        );
      });
      searchFor(container, 'contact id');
      expect(container.querySelector<HTMLInputElement>('.tbw-visibility-group-header input')!.disabled).toBe(true);
      expect(container.querySelector<HTMLInputElement>('.tbw-visibility-row input')!.disabled).toBe(true);
      searchFor(container, 'Contact');
      expect(container.querySelectorAll('.tbw-visibility-group-header')).toHaveLength(2);
      searchFor(container, 'Personal details');
      expect(renderedFields(container)).toEqual([]);
    });

    it('keeps Show All global even with no matches and preserves the query', () => {
      grid._hiddenColumns.add('age');
      grid._hiddenColumns.add('city');
      const panelPlugin = new VisibilityPlugin({ searchable: true });
      panelPlugin.attach(grid as GridElement);
      const container = document.createElement('div');
      panelPlugin.getToolPanel()!.render(container);
      const input = searchFor(container, 'nothing');
      container.querySelector<HTMLButtonElement>('.tbw-visibility-show-all')!.click();
      expect(grid.showAllColumns).toHaveBeenCalledOnce();
      expect(grid._hiddenColumns.size).toBe(0);
      expect(input.value).toBe('nothing');
      expect(renderedFields(container)).toEqual([]);
      searchFor(container, '');
      expect(renderedFields(container)).toEqual(['name', 'age', 'city']);
    });

    it('preserves the input, focus, and query on toggles and live column updates', async () => {
      const columns = defaultColumns.map((column) => ({ ...column }));
      const panelGrid = createGridMock(columns);
      const panelPlugin = new VisibilityPlugin({ searchable: true });
      panelPlugin.attach(panelGrid as GridElement);
      const container = document.createElement('div');
      document.body.appendChild(container);
      panelPlugin.getToolPanel()!.render(container);
      const input = searchFor(container, 'name');
      input.focus();
      container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
      await vi.waitFor(() =>
        expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false),
      );
      expect(panelGrid.toggleColumnVisibility).toHaveBeenCalledWith('name');
      expect(document.activeElement).toBe(input);
      expect(input.value).toBe('name');
      columns[0].header = 'Person';
      panelPlugin.afterRender();
      expect(renderedFields(container)).toEqual([]);
      columns.push({ field: 'new', header: 'New name' });
      panelPlugin.afterRender();
      expect(renderedFields(container)).toEqual(['new']);
      const checkbox = container.querySelector('input[type="checkbox"]');
      panelPlugin.afterRender();
      expect(container.querySelector('input[type="checkbox"]')).toBe(checkbox);
      expect(document.activeElement).toBe(input);
    });

    it('checks move permissions without per-column config scans on unchanged renders', () => {
      const columns = defaultColumns.map((column) => ({ ...column }));
      const panelGrid = createGridMock(columns);
      panelGrid.getPluginByName.mockImplementation(() => ({ moveColumn: vi.fn() }));
      const panelPlugin = new VisibilityPlugin({ searchable: true });
      panelPlugin.attach(panelGrid as GridElement);
      const container = document.createElement('div');
      panelPlugin.getToolPanel()!.render(container);
      const row = container.querySelector('.tbw-visibility-row');
      expect(row?.classList.contains('reorderable')).toBe(true);
      const find = vi.spyOn(columns, 'find');
      panelPlugin.afterRender();
      expect(find).not.toHaveBeenCalled();
      expect(container.querySelector('.tbw-visibility-row')).toBe(row);
    });

    it('retains the instance query on remount and cleans up old input listeners', () => {
      const panelPlugin = new VisibilityPlugin({ searchable: true });
      panelPlugin.attach(grid as GridElement);
      const container = document.createElement('div');
      const cleanup = panelPlugin.getToolPanel()!.render(container)!;
      const oldInput = searchFor(container, 'age');
      cleanup();
      oldInput.value = 'city';
      oldInput.dispatchEvent(new InputEvent('input'));
      panelPlugin.getToolPanel()!.render(container);
      expect(container.querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe('age');
      expect(renderedFields(container)).toEqual(['age']);
      panelPlugin.detach();
      const input = container.querySelector<HTMLInputElement>('input[type="search"]')!;
      input.value = 'city';
      input.dispatchEvent(new InputEvent('input'));
      expect(renderedFields(container)).toEqual(['age']);
      const fresh = new VisibilityPlugin({ searchable: true });
      fresh.attach(grid as GridElement);
      const freshContainer = document.createElement('div');
      fresh.getToolPanel()!.render(freshContainer);
      expect(freshContainer.querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe('');
    });

    it('localizes search text, isolates editing keys, and leaves Escape to the shell', () => {
      Object.assign(grid.effectiveConfig, {
        locale: {
          'columns.searchLabel': 'Find a column',
          'columns.searchPlaceholder': 'Type a name',
          'columns.noMatchingColumns': 'Nothing found',
        },
      });
      const panelPlugin = new VisibilityPlugin({ searchable: true });
      panelPlugin.attach(grid as GridElement);
      const container = document.createElement('div');
      panelPlugin.getToolPanel()!.render(container);
      const listener = vi.fn();
      container.addEventListener('keydown', listener);
      const input = searchFor(container, 'absent');
      expect(input.getAttribute('aria-label')).toBe('Find a column');
      expect(input.placeholder).toBe('Type a name');
      expect(container.querySelector('[role="status"]')!.textContent).toBe('Nothing found');
      expect(container.querySelector('[role="status"]')!.getAttribute('aria-live')).toBe('polite');
      for (const key of ['ArrowLeft', 'ArrowDown', ' ', 'Enter', 'Tab', 'a']) {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        input.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      }
      expect(listener).not.toHaveBeenCalled();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(listener).toHaveBeenCalledOnce();
    });

    it('waits for composition to end before filtering', () => {
      const panelPlugin = new VisibilityPlugin({ searchable: true });
      panelPlugin.attach(grid as GridElement);
      const container = document.createElement('div');
      panelPlugin.getToolPanel()!.render(container);
      const input = container.querySelector<HTMLInputElement>('input[type="search"]')!;
      input.value = 'age';
      input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
      expect(renderedFields(container)).toEqual(['name', 'age', 'city']);
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      expect(renderedFields(container)).toEqual(['age']);
    });
  });

  // #region handleQuery - context menu

  describe('handleQuery', () => {
    it('should return hide column item for header context menu', () => {
      const result = plugin.handleQuery({
        type: 'getContextMenuItems',
        context: {
          isHeader: true,
          column: { field: 'age', header: 'Age' },
        },
      } as any);

      expect(result).toBeInstanceOf(Array);
      const items = result as any[];
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('visibility/hide-column');
      expect(items[0].label).toBe('Hide Column');
    });

    it('should hide column when action is triggered', () => {
      const result = plugin.handleQuery({
        type: 'getContextMenuItems',
        context: {
          isHeader: true,
          column: { field: 'age', header: 'Age' },
        },
      } as any) as any[];

      result[0].action();
      expect(grid.setColumnVisible).toHaveBeenCalledWith('age', false);
    });

    it('should return undefined for non-header context', () => {
      const result = plugin.handleQuery({
        type: 'getContextMenuItems',
        context: {
          isHeader: false,
          column: { field: 'age' },
        },
      } as any);

      expect(result).toBeUndefined();
    });

    it('should return undefined when column has no field', () => {
      const result = plugin.handleQuery({
        type: 'getContextMenuItems',
        context: {
          isHeader: true,
          column: {},
        },
      } as any);

      expect(result).toBeUndefined();
    });

    it('should return undefined for lockVisibility columns', () => {
      const result = plugin.handleQuery({
        type: 'getContextMenuItems',
        context: {
          isHeader: true,
          column: { field: 'id', meta: { lockVisibility: true } },
        },
      } as any);

      expect(result).toBeUndefined();
    });

    it('should return undefined for unknown query types', () => {
      const result = plugin.handleQuery({
        type: 'unknownQuery',
        context: {},
      } as any);

      expect(result).toBeUndefined();
    });
  });

  // #endregion

  // #region detach

  describe('detach', () => {
    it('should clear internal state', () => {
      // First render panel to set internal columnListElement
      const panel = plugin.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      plugin.detach();

      // isPanelVisible should still work BUT columnListElement is null
      // The detach clears isDragging and drag fields
      // Verify by re-attaching and checking clean state
      const g2 = createGridMock(defaultColumns);
      plugin.attach(g2 as any);
      expect(plugin.isPanelVisible()).toBe(false);
    });
  });

  // #endregion

  // #region Reorder Integration (drag disabled without reorder plugin)

  describe('reorder integration', () => {
    it('should not make rows draggable without reorder plugin', () => {
      const panel = plugin.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const rows = container.querySelectorAll('.tbw-visibility-row');
      rows.forEach((row) => {
        expect((row as HTMLElement).draggable).not.toBe(true);
        expect(row.classList.contains('reorderable')).toBe(false);
      });
    });

    it('should make rows draggable when reorder plugin is present', () => {
      // Mock reorder plugin present
      grid.getPluginByName.mockImplementation((name: string) => {
        if (name === 'reorder') return { moveColumn: vi.fn() };
        return undefined;
      });

      const panel = plugin.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const rows = container.querySelectorAll('.tbw-visibility-row');
      rows.forEach((row) => {
        expect((row as HTMLElement).draggable).toBe(true);
        expect(row.classList.contains('reorderable')).toBe(true);
      });
    });

    it('should render drag handles when reorder plugin is present', () => {
      grid.getPluginByName.mockImplementation((name: string) => {
        if (name === 'reorder') return { moveColumn: vi.fn() };
        return undefined;
      });

      const panel = plugin.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const handles = container.querySelectorAll('.tbw-visibility-handle');
      expect(handles.length).toBe(3);
    });

    it('should not make lockPosition columns draggable', () => {
      grid.getPluginByName.mockImplementation((name: string) => {
        if (name === 'reorder') return { moveColumn: vi.fn() };
        return undefined;
      });

      const g = createGridMock([
        { field: 'id', header: 'ID', meta: { lockPosition: true } },
        { field: 'name', header: 'Name' },
      ]);
      g.getPluginByName.mockImplementation((name: string) => {
        if (name === 'reorder') return { moveColumn: vi.fn() };
        return undefined;
      });
      const p = new VisibilityPlugin();
      p.attach(g as any);

      const panel = p.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const idRow = container.querySelector('[data-field="id"]') as HTMLElement;
      expect(idRow.draggable).not.toBe(true);
      expect(idRow.classList.contains('reorderable')).toBe(false);

      const nameRow = container.querySelector('[data-field="name"]') as HTMLElement;
      expect(nameRow.draggable).toBe(true);
    });

    it('should not make suppressMovable columns draggable', () => {
      const g = createGridMock([
        { field: 'fixed', header: 'Fixed', meta: { suppressMovable: true } },
        { field: 'name', header: 'Name' },
      ]);
      g.getPluginByName.mockImplementation((name: string) => {
        if (name === 'reorder') return { moveColumn: vi.fn() };
        return undefined;
      });
      const p = new VisibilityPlugin();
      p.attach(g as any);

      const panel = p.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const fixedRow = container.querySelector('[data-field="fixed"]') as HTMLElement;
      expect(fixedRow.draggable).not.toBe(true);
    });

    it('should not make top-level lockPosition columns draggable', () => {
      const g = createGridMock([
        { field: 'id', header: 'ID', lockPosition: true },
        { field: 'name', header: 'Name' },
      ]);
      g.getPluginByName.mockImplementation((name: string) => {
        if (name === 'reorder') return { moveColumn: vi.fn() };
        return undefined;
      });
      const p = new VisibilityPlugin();
      p.attach(g as any);

      const panel = p.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const idRow = container.querySelector('[data-field="id"]') as HTMLElement;
      expect(idRow.draggable).not.toBe(true);
      expect(idRow.classList.contains('reorderable')).toBe(false);

      const nameRow = container.querySelector('[data-field="name"]') as HTMLElement;
      expect(nameRow.draggable).toBe(true);
    });
  });

  // #endregion

  // #region Click-only move menu (WCAG 2.2 SC 2.5.7)

  describe('click-only move menu (SC 2.5.7)', () => {
    /** Render the panel with a reorder plugin present. */
    function renderWithReorder(columns = defaultColumns) {
      const g = createGridMock(columns);
      g.getPluginByName.mockImplementation((name: string) => {
        if (name === 'reorder') return { moveColumn: vi.fn() };
        return undefined;
      });
      const p = new VisibilityPlugin();
      p.attach(g as any);
      const container = document.createElement('div');
      const cleanup = p.getToolPanel()!.render(container);
      return { grid: g, plugin: p, container, cleanup };
    }

    function handleFor(container: HTMLElement, field: string): HTMLElement {
      return container.querySelector(`[data-field="${field}"] .tbw-visibility-handle`) as HTMLElement;
    }

    function menuItems(): HTMLButtonElement[] {
      const menu = document.getElementById('tbw-visibility-move-menu');
      if (!menu || menu.hidden) return [];
      return [...menu.querySelectorAll<HTMLButtonElement>('button')];
    }

    /** The detail of the last `column-reorder-request` the plugin emitted. */
    function lastRequest(grid: ReturnType<typeof createGridMock>) {
      const events = grid.dispatchEvent.mock.calls
        .map(([event]) => event as CustomEvent<ColumnReorderRequestDetail>)
        .filter((event) => event.type === 'column-reorder-request');
      return events.pop()?.detail;
    }

    it('exposes the drag handle as an activatable control', () => {
      const { container } = renderWithReorder();
      const handle = handleFor(container, 'age');

      expect(handle.getAttribute('role')).toBe('button');
      expect(handle.tabIndex).toBe(-1);
      expect(handle.getAttribute('aria-label')).toContain('Age');
      // The handle stays part of the row's drag surface.
      expect(handle.draggable).not.toBe(true);
    });

    it('opens a move menu when the handle is clicked', () => {
      const { container } = renderWithReorder();
      handleFor(container, 'age').click();

      expect(menuItems().map((b) => b.textContent)).toEqual(['Move up', 'Move down', 'Move to top', 'Move to bottom']);
    });

    it('disables the upward moves for the first column', () => {
      const { container } = renderWithReorder();
      handleFor(container, 'name').click();

      const items = menuItems();
      expect(items.map((b) => b.disabled)).toEqual([true, false, true, false]);
    });

    it('disables the downward moves for the last column', () => {
      const { container } = renderWithReorder();
      handleFor(container, 'city').click();

      const items = menuItems();
      expect(items.map((b) => b.disabled)).toEqual([false, true, false, true]);
    });

    it('emits the same reorder request a drop one row up would produce', () => {
      const { grid: g, container } = renderWithReorder();
      handleFor(container, 'city').click();
      menuItems()[0].click();

      expect(lastRequest(g)).toEqual({ field: 'city', fromIndex: 2, toIndex: 1 });
    });

    it('emits the same reorder request a drop one row down would produce', () => {
      const { grid: g, container } = renderWithReorder();
      handleFor(container, 'name').click();
      menuItems()[1].click();

      expect(lastRequest(g)).toEqual({ field: 'name', fromIndex: 0, toIndex: 1 });
    });

    it('moves a column to the top', () => {
      const { grid: g, container } = renderWithReorder();
      handleFor(container, 'city').click();
      menuItems()[2].click();

      expect(lastRequest(g)).toEqual({ field: 'city', fromIndex: 2, toIndex: 0 });
    });

    it('moves a column to the bottom', () => {
      const { grid: g, container } = renderWithReorder();
      handleFor(container, 'name').click();
      menuItems()[3].click();

      expect(lastRequest(g)).toEqual({ field: 'name', fromIndex: 0, toIndex: 2 });
    });

    it('skips immovable neighbours when deciding what is reachable', () => {
      const { container } = renderWithReorder([
        { field: 'id', header: 'ID', lockPosition: true },
        { field: 'name', header: 'Name' },
        { field: 'city', header: 'City' },
      ]);
      // `id` has no handle at all — it cannot be dragged either.
      expect(handleFor(container, 'id')).toBeNull();

      handleFor(container, 'name').click();
      const items = menuItems();
      // Moving up would land on the locked `id` column.
      expect(items[0].disabled).toBe(true);
      expect(items[2].disabled).toBe(true);
      expect(items[1].disabled).toBe(false);
    });

    it('closes the menu when the panel is torn down and disposes it on detach', () => {
      const { plugin: p, container, cleanup } = renderWithReorder();
      handleFor(container, 'age').click();
      expect(menuItems().length).toBe(4);

      cleanup?.();
      expect(document.getElementById('tbw-visibility-move-menu')!.hidden).toBe(true);

      p.detach();
      expect(document.getElementById('tbw-visibility-move-menu')).toBeNull();
    });
  });

  // #endregion

  // #region Group rendering

  describe('group rendering', () => {
    const groupColumns = [
      { field: 'firstName', header: 'First Name' },
      { field: 'lastName', header: 'Last Name' },
      { field: 'email', header: 'Email' },
      { field: 'phone', header: 'Phone' },
    ];

    it('should render group sections when column grouping is available', () => {
      const g = createGridMock(groupColumns);
      const groupInfo = [
        { id: 'personal', label: 'Personal', fields: ['firstName', 'lastName'] },
        { id: 'contact', label: 'Contact', fields: ['email', 'phone'] },
      ];
      g.query.mockReturnValue([groupInfo]);
      const p = new VisibilityPlugin();
      p.attach(g as any);

      const panel = p.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const groupHeaders = container.querySelectorAll('.tbw-visibility-group-header');
      expect(groupHeaders.length).toBe(2);
      expect(groupHeaders[0].getAttribute('data-group-id')).toBe('personal');
      expect(groupHeaders[1].getAttribute('data-group-id')).toBe('contact');
    });

    it('should render grouped columns with --grouped class', () => {
      const g = createGridMock(groupColumns);
      g.query.mockReturnValue([[{ id: 'personal', label: 'Personal', fields: ['firstName', 'lastName'] }]]);
      const p = new VisibilityPlugin();
      p.attach(g as any);

      const panel = p.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const groupedRows = container.querySelectorAll('.tbw-visibility-row--grouped');
      expect(groupedRows.length).toBe(2);
    });

    it('should render ungrouped columns as flat rows', () => {
      const g = createGridMock(groupColumns);
      g.query.mockReturnValue([[{ id: 'personal', label: 'Personal', fields: ['firstName', 'lastName'] }]]);
      const p = new VisibilityPlugin();
      p.attach(g as any);

      const panel = p.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      // email and phone are not in any group
      const allRows = container.querySelectorAll('.tbw-visibility-row');
      const ungroupedRows = Array.from(allRows).filter((r) => !r.classList.contains('tbw-visibility-row--grouped'));
      expect(ungroupedRows.length).toBe(2);
      const fields = ungroupedRows.map((r) => r.getAttribute('data-field'));
      expect(fields).toContain('email');
      expect(fields).toContain('phone');
    });

    it('should render group header checkbox with tri-state', () => {
      const g = createGridMock(groupColumns);
      g.query.mockReturnValue([[{ id: 'personal', label: 'Personal', fields: ['firstName', 'lastName'] }]]);
      // Hide one of the group's columns
      g._hiddenColumns.add('lastName');
      const p = new VisibilityPlugin();
      p.attach(g as any);

      const panel = p.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const groupHeader = container.querySelector('.tbw-visibility-group-header');
      const cb = groupHeader!.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(cb.indeterminate).toBe(true);
    });

    it('should render flat list when no groups query returns empty', () => {
      const g = createGridMock(groupColumns);
      g.query.mockReturnValue([]);
      const p = new VisibilityPlugin();
      p.attach(g as any);

      const panel = p.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const groupHeaders = container.querySelectorAll('.tbw-visibility-group-header');
      expect(groupHeaders.length).toBe(0);

      const rows = container.querySelectorAll('.tbw-visibility-row');
      expect(rows.length).toBe(4);
    });
  });

  // #endregion

  // #region Checkbox toggling in panel

  describe('checkbox toggling in panel', () => {
    it('should call toggleColumnVisibility when checkbox is clicked', () => {
      const panel = plugin.getToolPanel()!;
      const container = document.createElement('div');
      panel.render(container);

      const ageRow = container.querySelector('[data-field="age"]');
      const cb = ageRow!.querySelector('input[type="checkbox"]') as HTMLInputElement;

      cb.checked = false;
      cb.dispatchEvent(new Event('change'));

      expect(grid.toggleColumnVisibility).toHaveBeenCalledWith('age');
    });
  });

  // #endregion

  // #region attach - column-move listener

  describe('attach', () => {
    it('should register column-move listener on gridElement', () => {
      const spy = vi.spyOn(grid._hostElement, 'addEventListener');
      const p = new VisibilityPlugin();
      p.attach(grid as any);

      // Verify the event name and that a signal was passed
      const call = spy.mock.calls.find((c) => c[0] === 'column-move');
      expect(call).toBeDefined();
      expect(typeof call![1]).toBe('function');
      expect((call![2] as any)?.signal).toBeDefined();
    });
  });

  // #endregion
});
