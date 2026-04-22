/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisibilityPlugin } from './VisibilityPlugin';

function createGridMock(columns: any[] = []) {
  const gridEl = document.createElement('div');
  const abortCtrl = new AbortController();

  // Track column visibility state for the mock
  const hiddenColumns = new Set<string>();
  const expandedSections: string[] = [];
  let toolPanelOpen = false;

  const allColumnsProvider = () =>
    columns.map((c: any) => ({
      field: c.field,
      header: c.header ?? c.field,
      visible: !hiddenColumns.has(c.field) && c.visible !== false,
      lockVisible: c.lockVisible ?? c.meta?.lockVisibility ?? false,
      lockPosition: c.lockPosition ?? c.meta?.lockPosition ?? false,
      utility: c.utility ?? c.meta?.utility ?? false,
      meta: c.meta ?? {},
    }));

  return {
    rows: [],
    sourceRows: [],
    columns,
    _visibleColumns: columns.filter((c: any) => !c.hidden),
    _hostElement: gridEl,
    gridConfig: {},
    effectiveConfig: {},
    getPlugin: vi.fn(() => undefined),
    getPluginByName: vi.fn(() => undefined),
    getPluginState: vi.fn(() => null),
    query: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    requestRender: vi.fn(),
    requestStateChange: vi.fn(),
    children: [document.createElement('div')],
    querySelectorAll: () => [],
    querySelector: () => null,
    clientWidth: 800,
    classList: { add: vi.fn(), remove: vi.fn() },
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

    // Tool panel API
    get isToolPanelOpen() {
      return toolPanelOpen;
    },
    openToolPanel: vi.fn(() => {
      toolPanelOpen = true;
    }),
    closeToolPanel: vi.fn(() => {
      toolPanelOpen = false;
    }),
    get expandedToolPanelSections() {
      return expandedSections;
    },
    toggleToolPanelSection: vi.fn((id: string) => {
      const idx = expandedSections.indexOf(id);
      if (idx >= 0) expandedSections.splice(idx, 1);
      else expandedSections.push(id);
    }),

    // Hidden columns state (for test introspection)
    _hiddenColumns: hiddenColumns,
    _expandedSections: expandedSections,
    _setToolPanelOpen: (v: boolean) => {
      toolPanelOpen = v;
    },
  };
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
      expect(VisibilityPlugin.dependencies).toEqual([{ name: 'reorder', required: false, reason: expect.any(String) }]);
    });

    it('should declare manifest with getContextMenuItems query', () => {
      expect(VisibilityPlugin.manifest.queries).toEqual([
        { type: 'getContextMenuItems', description: expect.any(String) },
      ]);
    });

    it('should have default allowHideAll as false', () => {
      const p = new VisibilityPlugin();
      const g = createGridMock(defaultColumns);
      p.attach(g as any);
      expect(p.config.allowHideAll).toBe(false);
    });

    it('should accept custom config', () => {
      const p = new VisibilityPlugin({ allowHideAll: true });
      const g = createGridMock(defaultColumns);
      p.attach(g as any);
      expect(p.config.allowHideAll).toBe(true);
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
    it('should open tool panel', () => {
      plugin.show();
      expect(grid.openToolPanel).toHaveBeenCalled();
    });

    it('should expand the visibility section if not already expanded', () => {
      plugin.show();
      expect(grid.toggleToolPanelSection).toHaveBeenCalledWith('columns');
    });

    it('should not toggle section if already expanded', () => {
      grid._expandedSections.push('columns');
      plugin.show();
      expect(grid.toggleToolPanelSection).not.toHaveBeenCalled();
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
