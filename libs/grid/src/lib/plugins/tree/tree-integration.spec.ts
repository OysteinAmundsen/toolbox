import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TreePlugin } from './TreePlugin';
import type { TreeConfig } from './types';

// Import grid for full integration test
import '../../../index';
import type { GridElement } from '../../../public';

/** Wait for custom element upgrade + ready promise */
async function waitUpgrade(el: GridElement): Promise<void> {
  await customElements.whenDefined('tbw-grid');
  await (el as any).ready?.();
  await new Promise((r) => requestAnimationFrame(r));
}

describe('tree plugin integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });
  it('should populate flattenedRows in processRows and use them in processColumns', () => {
    // Create plugin with tree config
    const config: TreeConfig = {
      defaultExpanded: true,
      childrenField: 'children',
      indentWidth: 20,
      showExpandIcons: true,
    };
    const plugin = new TreePlugin(config);

    // Mock grid for attach
    const mockGrid = {
      dispatchEvent: () => {
        /* noop */
      },
      requestRender: () => {
        /* noop */
      },
      rows: [],
      _columns: [],
    };
    plugin.attach(mockGrid as any);

    // Sample tree data
    const rows = [
      { name: 'Engineering', children: [{ name: 'Alice' }, { name: 'Bob' }] },
      { name: 'Marketing', children: [{ name: 'Dan' }] },
    ];

    // Run processRows
    const processedRows = plugin.processRows(rows);

    // Verify processRows worked
    expect(processedRows).toHaveLength(5); // 2 parents + 3 children
    expect(processedRows[0].__treeDepth).toBe(0);
    expect(processedRows[0].__treeHasChildren).toBe(true);
    expect(processedRows[1].__treeDepth).toBe(1);

    // Run processColumns
    const cols = [{ field: 'name', header: 'Name' }];
    const processedCols = plugin.processColumns(cols);

    // Verify processColumns wrapped the first column
    expect(processedCols[0].viewRenderer).toBeDefined();
    expect(typeof processedCols[0].viewRenderer).toBe('function');
  });

  it('should return columns unchanged if flattenedRows is empty', () => {
    const plugin = new TreePlugin({});

    // Mock grid for attach
    const mockGrid = {
      dispatchEvent: () => {
        /* noop */
      },
      requestRender: () => {
        /* noop */
      },
      rows: [],
      _columns: [],
    };
    plugin.attach(mockGrid as any);

    const cols = [{ field: 'name', header: 'Name' }];
    const processedCols = plugin.processColumns(cols);

    expect(processedCols[0].viewRenderer).toBeUndefined();
  });

  it('should wrap the specified treeColumn instead of the first column', () => {
    const config: TreeConfig = {
      defaultExpanded: true,
      childrenField: 'children',
      treeColumn: 'name',
    };
    const plugin = new TreePlugin(config);

    const mockGrid = {
      dispatchEvent: () => {
        /* noop */
      },
      requestRender: () => {
        /* noop */
      },
      rows: [],
      _columns: [],
    };
    plugin.attach(mockGrid as any);

    const rows = [{ id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] }];
    plugin.processRows(rows);

    const cols = [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' },
    ];
    const processedCols = plugin.processColumns(cols);

    // ID column should be untouched
    expect(processedCols[0].viewRenderer).toBeUndefined();
    // Name column should be wrapped with tree renderer
    expect(processedCols[1].viewRenderer).toBeDefined();
    expect(typeof processedCols[1].viewRenderer).toBe('function');
  });

  it('should fall back to first column when treeColumn field is not found', () => {
    const config: TreeConfig = {
      defaultExpanded: true,
      childrenField: 'children',
      treeColumn: 'nonExistentField',
    };
    const plugin = new TreePlugin(config);

    const mockGrid = {
      dispatchEvent: () => {
        /* noop */
      },
      requestRender: () => {
        /* noop */
      },
      rows: [],
      _columns: [],
    };
    plugin.attach(mockGrid as any);

    const rows = [{ id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] }];
    plugin.processRows(rows);

    const cols = [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' },
    ];
    const processedCols = plugin.processColumns(cols);

    // Should wrap first column as fallback
    expect(processedCols[0].viewRenderer).toBeDefined();
    expect(processedCols[1].viewRenderer).toBeUndefined();
  });

  it('should correctly flatten rows after expansion toggle', () => {
    const config: TreeConfig = {
      defaultExpanded: false,
      childrenField: 'children',
      indentWidth: 20,
      showExpandIcons: true,
    };
    const plugin = new TreePlugin(config);

    const mockGrid = {
      dispatchEvent: () => {
        /* noop */
      },
      requestRender: () => {
        /* noop */
      },
      rows: [],
      _columns: [],
    };
    plugin.attach(mockGrid as any);

    // Sample tree data matching the story
    const rows = [
      {
        name: 'Documents',
        type: 'folder',
        size: '-',
        children: [
          { name: 'Resume.pdf', type: 'file', size: '2.4 MB' },
          { name: 'Cover Letter.docx', type: 'file', size: '156 KB' },
          {
            name: 'Projects',
            type: 'folder',
            size: '-',
            children: [{ name: 'notes.txt', type: 'file', size: '12 KB' }],
          },
        ],
      },
      {
        name: 'Pictures',
        type: 'folder',
        size: '-',
        children: [{ name: 'vacation.jpg', type: 'file', size: '4.2 MB' }],
      },
      { name: 'readme.md', type: 'file', size: '1 KB' },
    ];

    // Initial process - should show only root nodes (collapsed)
    let processedRows = plugin.processRows(rows);
    expect(processedRows).toHaveLength(3);
    expect(processedRows[0].name).toBe('Documents');
    expect(processedRows[1].name).toBe('Pictures');
    expect(processedRows[2].name).toBe('readme.md');

    // Expand Documents (key "0")
    plugin.expand('0');

    // Manually trigger processRows again (simulating what requestRender does)
    processedRows = plugin.processRows(rows);

    // After expanding Documents, should have 6 rows
    expect(processedRows).toHaveLength(6);
    expect(processedRows[0].name).toBe('Documents');
    expect(processedRows[0].__treeExpanded).toBe(true);
    expect(processedRows[1].name).toBe('Resume.pdf');
    expect(processedRows[1].__treeDepth).toBe(1);
    expect(processedRows[2].name).toBe('Cover Letter.docx');
    expect(processedRows[2].__treeDepth).toBe(1);
    expect(processedRows[3].name).toBe('Projects');
    expect(processedRows[3].__treeDepth).toBe(1);
    expect(processedRows[4].name).toBe('Pictures');
    expect(processedRows[4].__treeDepth).toBe(0);
    expect(processedRows[5].name).toBe('readme.md');
    expect(processedRows[5].__treeDepth).toBe(0);
  });

  it('should render correct rows in DOM after expansion', async () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    document.body.appendChild(grid);

    const treePlugin = new TreePlugin({
      defaultExpanded: false,
      childrenField: 'children',
      indentWidth: 20,
      showExpandIcons: true,
    });

    grid.gridConfig = {
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'type', header: 'Type' },
        { field: 'size', header: 'Size' },
      ],
      plugins: [treePlugin],
    };

    grid.rows = [
      {
        name: 'Documents',
        type: 'folder',
        size: '-',
        children: [
          { name: 'Resume.pdf', type: 'file', size: '2.4 MB' },
          { name: 'Cover Letter.docx', type: 'file', size: '156 KB' },
          { name: 'Projects', type: 'folder', size: '-' },
        ],
      },
      { name: 'Pictures', type: 'folder', size: '-' },
      { name: 'readme.md', type: 'file', size: '1 KB' },
    ];

    await waitUpgrade(grid);

    // Initially should have 3 rows
    let dataRows = grid.querySelectorAll('.data-grid-row');
    expect(dataRows?.length).toBe(3);

    // Check grid's internal _rows before expansion
    const internalRowsBefore = (grid as any)._rows;
    expect(internalRowsBefore.length).toBe(3);
    expect(internalRowsBefore[0].name).toBe('Documents');

    // Expand Documents
    treePlugin.expand('0');
    await new Promise((r) => requestAnimationFrame(r));

    // Check grid's internal _rows after expansion
    const internalRowsAfter = (grid as any)._rows;
    expect(internalRowsAfter.length).toBe(6);
    expect(internalRowsAfter[0].name).toBe('Documents');
    expect(internalRowsAfter[1].name).toBe('Resume.pdf');
    expect(internalRowsAfter[2].name).toBe('Cover Letter.docx');

    // After expansion should have 6 rows
    dataRows = grid.querySelectorAll('.data-grid-row');
    expect(dataRows?.length).toBe(6);

    // Check that row order is correct by checking the name column (data-col="0" since tree wraps first column)
    const nameCells = Array.from(dataRows!).map((row) => {
      // The tree-cell-wrapper contains a .tree-content span with the actual text
      const cell = row.querySelector('.cell[data-col="0"]');
      const treeContent = cell?.querySelector('.tree-content');
      return treeContent?.textContent?.trim() ?? cell?.textContent?.trim();
    });

    // The name should appear in the first column (tree wraps first column)
    expect(nameCells).toEqual(['Documents', 'Resume.pdf', 'Cover Letter.docx', 'Projects', 'Pictures', 'readme.md']);
  });

  describe('TreePlugin public API', () => {
    const createPluginWithData = () => {
      const config: TreeConfig = {
        defaultExpanded: false,
        childrenField: 'children',
      };
      const plugin = new TreePlugin(config);

      const rows = [
        {
          id: 'folder1',
          name: 'Documents',
          children: [
            { id: 'file1', name: 'Resume.pdf' },
            { id: 'file2', name: 'Cover.docx' },
          ],
        },
        { id: 'folder2', name: 'Pictures', children: [{ id: 'file3', name: 'photo.jpg' }] },
        { id: 'file4', name: 'readme.md' },
      ];

      const mockGrid = {
        dispatchEvent: () => {
          /* noop */
        },
        requestRender: () => {
          /* noop */
        },
        rows: rows, // Provide rows for expandAll/collapseAll/expandToKey
        _columns: [],
      };
      plugin.attach(mockGrid as any);

      plugin.processRows(rows);
      return { plugin, rows };
    };

    it('collapse() should remove key from expandedKeys', () => {
      const { plugin } = createPluginWithData();

      plugin.expand('folder1');
      expect(plugin.isExpanded('folder1')).toBe(true);

      plugin.collapse('folder1');
      expect(plugin.isExpanded('folder1')).toBe(false);
    });

    it('toggle() should flip expansion state', () => {
      const { plugin } = createPluginWithData();

      expect(plugin.isExpanded('folder1')).toBe(false);
      plugin.toggle('folder1');
      expect(plugin.isExpanded('folder1')).toBe(true);
      plugin.toggle('folder1');
      expect(plugin.isExpanded('folder1')).toBe(false);
    });

    it('expandAll() should expand all nodes', () => {
      const { plugin, rows } = createPluginWithData();

      plugin.expandAll();
      const processedRows = plugin.processRows(rows);

      // All 6 rows should be visible
      expect(processedRows).toHaveLength(6);
      expect(plugin.isExpanded('folder1')).toBe(true);
      expect(plugin.isExpanded('folder2')).toBe(true);
    });

    it('collapseAll() should collapse all nodes', () => {
      const { plugin, rows } = createPluginWithData();

      plugin.expandAll();
      expect(plugin.getExpandedKeys().length).toBeGreaterThan(0);

      plugin.collapseAll();
      expect(plugin.getExpandedKeys()).toHaveLength(0);

      const processedRows = plugin.processRows(rows);
      expect(processedRows).toHaveLength(3); // Only root nodes
    });

    it('getExpandedKeys() should return all expanded keys', () => {
      const { plugin } = createPluginWithData();

      plugin.expand('folder1');
      plugin.expand('folder2');

      const keys = plugin.getExpandedKeys();
      expect(keys).toContain('folder1');
      expect(keys).toContain('folder2');
      expect(keys).toHaveLength(2);
    });

    it('getFlattenedRows() should return flattened row metadata', () => {
      const { plugin } = createPluginWithData();

      const flatRows = plugin.getFlattenedRows();
      expect(flatRows).toHaveLength(3);
      expect(flatRows[0].key).toBe('folder1');
      expect(flatRows[0].depth).toBe(0);
      expect(flatRows[0].hasChildren).toBe(true);
    });

    it('getRowByKey() should return original row data', () => {
      const { plugin } = createPluginWithData();

      const row = plugin.getRowByKey('folder1');
      expect(row).toBeDefined();
      expect(row.name).toBe('Documents');
      expect(row.children).toHaveLength(2);
    });

    it('getRowByKey() should return undefined for unknown key', () => {
      const { plugin } = createPluginWithData();

      const row = plugin.getRowByKey('nonexistent');
      expect(row).toBeUndefined();
    });

    it('expandToKey() should expand ancestors to make node visible', () => {
      const { plugin, rows } = createPluginWithData();

      // file1 is child of folder1, so folder1 should expand
      plugin.expandToKey('file1');

      expect(plugin.isExpanded('folder1')).toBe(true);

      const processedRows = plugin.processRows(rows);
      const names = processedRows.map((r: any) => r.name);
      expect(names).toContain('Resume.pdf');
    });
  });

  describe('TreePlugin onCellClick', () => {
    it('should toggle expansion when clicking tree-toggle', async () => {
      const grid = document.createElement('tbw-grid') as GridElement;
      document.body.appendChild(grid);

      const treePlugin = new TreePlugin({
        defaultExpanded: false,
        childrenField: 'children',
        showExpandIcons: true,
      });

      grid.gridConfig = {
        columns: [
          { field: 'name', header: 'Name' },
          { field: 'type', header: 'Type' },
        ],
        plugins: [treePlugin],
      };

      grid.rows = [
        {
          id: 'folder1',
          name: 'Documents',
          type: 'folder',
          children: [{ id: 'file1', name: 'Resume.pdf', type: 'file' }],
        },
      ];

      await waitUpgrade(grid);

      // Debug: Check if rows are rendered
      const dataRows = grid.querySelectorAll('.data-grid-row');
      expect(dataRows?.length).toBeGreaterThan(0);

      // With wrap-first-column approach, tree toggle is inside the first column's cell
      const firstCell = grid.querySelector('.data-grid-row .cell[data-col="0"]') as HTMLElement;
      expect(firstCell).not.toBeNull();

      // Find the tree toggle inside the first cell's tree-cell-wrapper
      const toggle = firstCell?.querySelector('.tree-toggle') as HTMLElement;
      expect(toggle).toBeDefined();
      expect(toggle).not.toBeNull();

      // Click the toggle - use dispatchEvent to ensure bubbling works correctly
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      // Wait for scheduler to flush
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));

      // Should now be expanded
      expect(treePlugin.isExpanded('folder1')).toBe(true);

      // Should show child row
      const dataRowsAfter = grid.querySelectorAll('.data-grid-row');
      expect(dataRowsAfter?.length).toBe(2);
    });

    it('should return false when clicking non-toggle element', () => {
      const plugin = new TreePlugin({});
      const mockGrid = {
        dispatchEvent: () => {
          /* noop */
        },
        requestRender: () => {
          /* noop */
        },
        rows: [],
        _columns: [],
      };
      plugin.attach(mockGrid as any);

      const result = plugin.onCellClick({
        rowIndex: 0,
        colIndex: 0,
        originalEvent: { target: document.createElement('span') } as any,
      });

      expect(result).toBe(false);
    });

    it('should return false when toggle has no data-tree-key', () => {
      const plugin = new TreePlugin({});
      const mockGrid = {
        dispatchEvent: () => {
          /* noop */
        },
        requestRender: () => {
          /* noop */
        },
        rows: [],
        _columns: [],
      };
      plugin.attach(mockGrid as any);

      const toggle = document.createElement('span');
      toggle.classList.add('tree-toggle');

      const result = plugin.onCellClick({
        rowIndex: 0,
        colIndex: 0,
        originalEvent: { target: toggle } as any,
      });

      expect(result).toBe(false);
    });

    it('should return false when key not found in rowKeyMap', () => {
      const plugin = new TreePlugin({});
      const mockGrid = {
        dispatchEvent: () => {
          /* noop */
        },
        requestRender: () => {
          /* noop */
        },
        rows: [],
        _columns: [],
      };
      plugin.attach(mockGrid as any);

      // Process some rows to initialize
      plugin.processRows([{ name: 'Test' }]);

      const toggle = document.createElement('span');
      toggle.classList.add('tree-toggle');
      toggle.setAttribute('data-tree-key', 'nonexistent-key');

      const result = plugin.onCellClick({
        rowIndex: 0,
        colIndex: 0,
        originalEvent: { target: toggle } as any,
      });

      expect(result).toBe(false);
    });
  });

  describe('TreePlugin datasource integration', () => {
    it('should claim datasource:data events', () => {
      const plugin = new TreePlugin();
      const eventListeners = new Map<string, (detail: unknown) => void>();
      const mockGrid = {
        dispatchEvent: () => {
          /* noop */
        },
        requestRender: () => {
          /* noop */
        },
        rows: [],
        _columns: [],
        query: () => undefined,
        _pluginManager: {
          subscribe(_p: unknown, eventType: string, callback: (detail: unknown) => void) {
            eventListeners.set(eventType, callback);
          },
          unsubscribe: () => {
            /* noop */
          },
          emitPluginEvent: () => {
            /* noop */
          },
        },
      };
      plugin.attach(mockGrid as any);

      const detail = { rows: [{ id: 1 }], totalNodeCount: 1, startNode: 0, endNode: 1, claimed: false };
      eventListeners.get('datasource:data')?.(detail);

      expect(detail.claimed).toBe(true);
    });

    it('should claim and process datasource:children events for source=tree', () => {
      const plugin = new TreePlugin();
      const eventListeners = new Map<string, (detail: unknown) => void>();
      const renderCalls: unknown[] = [];
      const mockGrid = {
        dispatchEvent: () => {
          /* noop */
        },
        requestRender: () => renderCalls.push(true),
        rows: [],
        _columns: [],
        query: () => undefined,
        _pluginManager: {
          subscribe(_p: unknown, eventType: string, callback: (detail: unknown) => void) {
            eventListeners.set(eventType, callback);
          },
          unsubscribe: () => {
            /* noop */
          },
          emitPluginEvent: () => {
            /* noop */
          },
        },
      };
      plugin.attach(mockGrid as any);

      const parentRow: Record<string, unknown> = { id: 1, name: 'Parent', children: [] };
      const detail = {
        rows: [{ id: 10, name: 'Child 1' }],
        context: { source: 'tree', parentNode: parentRow },
        claimed: false,
      };
      eventListeners.get('datasource:children')?.(detail);

      expect(detail.claimed).toBe(true);
      expect(parentRow.children).toEqual([{ id: 10, name: 'Child 1' }]);
      expect(renderCalls.length).toBe(1);
    });

    it('should ignore datasource:children events for other sources', () => {
      const plugin = new TreePlugin();
      const eventListeners = new Map<string, (detail: unknown) => void>();
      const mockGrid = {
        dispatchEvent: () => {
          /* noop */
        },
        requestRender: () => {
          /* noop */
        },
        rows: [],
        _columns: [],
        query: () => undefined,
        _pluginManager: {
          subscribe(_p: unknown, eventType: string, callback: (detail: unknown) => void) {
            eventListeners.set(eventType, callback);
          },
          unsubscribe: () => {
            /* noop */
          },
          emitPluginEvent: () => {
            /* noop */
          },
        },
      };
      plugin.attach(mockGrid as any);

      const detail = {
        rows: [{ id: 10 }],
        context: { source: 'grouping-rows', group: {} },
        claimed: false,
      };
      eventListeners.get('datasource:children')?.(detail);

      expect(detail.claimed).toBe(false);
    });

    it('should respond to datasource:viewport-mapping queries', () => {
      const plugin = new TreePlugin();
      const mockGrid = {
        dispatchEvent: () => {
          /* noop */
        },
        requestRender: () => {
          /* noop */
        },
        rows: [
          { id: 1, name: 'A', children: [{ id: 10, name: 'A1' }] },
          { id: 2, name: 'B', children: [] },
        ],
        _columns: [],
        query: () => undefined,
        _pluginManager: {
          subscribe: () => {
            /* noop */
          },
          unsubscribe: () => {
            /* noop */
          },
          emitPluginEvent: () => {
            /* noop */
          },
        },
      };
      plugin.attach(mockGrid as any);

      // Trigger processRows to build flattenedRows
      plugin.processRows(mockGrid.rows);

      // Query viewport mapping
      const result = plugin.handleQuery({
        type: 'datasource:viewport-mapping',
        context: { viewportStart: 0, viewportEnd: 2 },
      });

      expect(result).toEqual({
        startNode: 0,
        endNode: 2, // exclusive, 2 top-level nodes visible
        totalLoadedNodes: 2,
      });
    });

    it('should fire datasource:fetch-children on expand when children are lazy (truthy non-array)', () => {
      const plugin = new TreePlugin({ childrenField: 'children', defaultExpanded: false });
      const eventListeners = new Map<string, (detail: unknown) => void>();
      const queryCalls: Array<{ type: string; context: unknown }> = [];
      const mockGrid = {
        dispatchEvent: () => {
          /* noop */
        },
        requestRender: () => {
          /* noop */
        },
        rows: [],
        _columns: [],
        query: (type: string, context: unknown) => {
          queryCalls.push({ type, context });
          if (type === 'datasource:is-active') return true;
          return undefined;
        },
        _pluginManager: {
          subscribe(_p: unknown, eventType: string, callback: (detail: unknown) => void) {
            eventListeners.set(eventType, callback);
          },
          unsubscribe: () => {
            /* noop */
          },
          emitPluginEvent: () => {
            /* noop */
          },
        },
      };
      plugin.attach(mockGrid as any);

      // Rows with lazy children: `children: true` signals "has children, not loaded"
      const rows = [
        { id: 1, name: 'Parent', children: true },
        { id: 2, name: 'Leaf' },
      ];
      plugin.processRows(rows);

      // Verify the lazy node is detected as having children
      const processed = plugin.processRows(rows);
      expect(processed[0].__treeHasChildren).toBe(true);
      expect(processed[1].__treeHasChildren).toBe(false);

      // Expand the lazy parent via toggle icon click
      const toggle = document.createElement('span');
      toggle.classList.add('tree-toggle');
      toggle.setAttribute('data-tree-key', '1');

      plugin.onCellClick({
        rowIndex: 0,
        colIndex: 0,
        originalEvent: { target: toggle } as any,
      });

      // Should have queried datasource:is-active and then datasource:fetch-children
      const isActiveQuery = queryCalls.find((q) => q.type === 'datasource:is-active');
      expect(isActiveQuery).toBeDefined();

      const fetchChildrenQuery = queryCalls.find((q) => q.type === 'datasource:fetch-children');
      expect(fetchChildrenQuery).toBeDefined();
      expect((fetchChildrenQuery?.context as any).context.source).toBe('tree');
      expect((fetchChildrenQuery?.context as any).context.parentNode.id).toBe(1);
    });

    it('should NOT fire datasource:fetch-children when children are embedded (array)', () => {
      const plugin = new TreePlugin({ childrenField: 'children', defaultExpanded: false });
      const queryCalls: Array<{ type: string; context: unknown }> = [];
      const mockGrid = {
        dispatchEvent: () => {
          /* noop */
        },
        requestRender: () => {
          /* noop */
        },
        rows: [],
        _columns: [],
        query: (type: string, context: unknown) => {
          queryCalls.push({ type, context });
          if (type === 'datasource:is-active') return true;
          return undefined;
        },
        _pluginManager: {
          subscribe: () => {
            /* noop */
          },
          unsubscribe: () => {
            /* noop */
          },
          emitPluginEvent: () => {
            /* noop */
          },
        },
      };
      plugin.attach(mockGrid as any);

      // Rows with embedded children
      const rows = [{ id: 1, name: 'Parent', children: [{ id: 10, name: 'Child' }] }];
      plugin.processRows(rows);

      // Expand the parent via toggle icon click
      const toggle = document.createElement('span');
      toggle.classList.add('tree-toggle');
      toggle.setAttribute('data-tree-key', '1');

      plugin.onCellClick({
        rowIndex: 0,
        colIndex: 0,
        originalEvent: { target: toggle } as any,
      });

      // Should NOT fire fetch-children (children are already embedded)
      const fetchChildrenQuery = queryCalls.find((q) => q.type === 'datasource:fetch-children');
      expect(fetchChildrenQuery).toBeUndefined();
    });

    it('should NOT fire datasource:fetch-children when ServerSide is not active', () => {
      const plugin = new TreePlugin({ childrenField: 'children' });
      const queryCalls: Array<{ type: string; context: unknown }> = [];
      const mockGrid = {
        dispatchEvent: () => {
          /* noop */
        },
        requestRender: () => {
          /* noop */
        },
        rows: [],
        _columns: [],
        query: (type: string, context: unknown) => {
          queryCalls.push({ type, context });
          if (type === 'datasource:is-active') return false; // No ServerSide
          return undefined;
        },
        _pluginManager: {
          subscribe: () => {
            /* noop */
          },
          unsubscribe: () => {
            /* noop */
          },
          emitPluginEvent: () => {
            /* noop */
          },
        },
      };
      plugin.attach(mockGrid as any);

      const rows = [{ id: 1, name: 'Parent', children: true }];
      plugin.processRows(rows);

      const toggle = document.createElement('span');
      toggle.classList.add('tree-toggle');
      toggle.setAttribute('data-tree-key', '1');

      plugin.onCellClick({
        rowIndex: 0,
        colIndex: 0,
        originalEvent: { target: toggle } as any,
      });

      // Should query is-active but NOT fire fetch-children
      expect(queryCalls.find((q) => q.type === 'datasource:is-active')).toBeDefined();
      expect(queryCalls.find((q) => q.type === 'datasource:fetch-children')).toBeUndefined();
    });

    it('should clear loadingKeys when datasource:children arrives', () => {
      const plugin = new TreePlugin({ childrenField: 'children' });
      const eventListeners = new Map<string, (detail: unknown) => void>();
      const queryCalls: Array<{ type: string }> = [];
      const mockGrid = {
        dispatchEvent: () => {
          /* noop */
        },
        requestRender: () => {
          /* noop */
        },
        rows: [],
        _columns: [],
        query: (type: string, context: unknown) => {
          queryCalls.push({ type });
          if (type === 'datasource:is-active') return true;
          return undefined;
        },
        _pluginManager: {
          subscribe(_p: unknown, eventType: string, callback: (detail: unknown) => void) {
            eventListeners.set(eventType, callback);
          },
          unsubscribe: () => {
            /* noop */
          },
          emitPluginEvent: () => {
            /* noop */
          },
        },
      };
      plugin.attach(mockGrid as any);

      const parentRow: Record<string, unknown> = { id: 1, name: 'Parent', children: true };
      plugin.processRows([parentRow]);

      // Expand to trigger fetch
      const toggle = document.createElement('span');
      toggle.classList.add('tree-toggle');
      toggle.setAttribute('data-tree-key', '1');
      plugin.onCellClick({ rowIndex: 0, colIndex: 0, originalEvent: { target: toggle } as any });

      // First fetch fires
      expect(queryCalls.filter((q) => q.type === 'datasource:fetch-children').length).toBe(1);

      // Expanding again (e.g., collapse then expand) should fire again since children haven't arrived
      // First collapse
      plugin.onCellClick({ rowIndex: 0, colIndex: 0, originalEvent: { target: toggle } as any });
      // Expand again — should NOT fire because loadingKeys still has the key
      plugin.processRows([parentRow]); // Rebuild flattenedRows
      plugin.onCellClick({ rowIndex: 0, colIndex: 0, originalEvent: { target: toggle } as any });
      expect(queryCalls.filter((q) => q.type === 'datasource:fetch-children').length).toBe(1); // Still 1

      // Simulate children arriving
      const childDetail = {
        rows: [{ id: 10, name: 'Child' }],
        context: { source: 'tree', parentNode: parentRow },
        claimed: false,
      };
      eventListeners.get('datasource:children')?.(childDetail);

      // Now parent has embedded children — subsequent expand won't fire fetch
      plugin.processRows([parentRow]);
      const processed = plugin.processRows([parentRow]);
      expect(processed[0].__treeHasChildren).toBe(true);
      expect(Array.isArray(parentRow.children)).toBe(true);
    });

    it('should detect lazy children with truthy non-array children field values', () => {
      const plugin = new TreePlugin({ childrenField: 'children' });
      const mockGrid = {
        dispatchEvent: () => {
          /* noop */
        },
        requestRender: () => {
          /* noop */
        },
        rows: [],
        _columns: [],
        query: () => undefined,
        _pluginManager: {
          subscribe: () => {
            /* noop */
          },
          unsubscribe: () => {
            /* noop */
          },
          emitPluginEvent: () => {
            /* noop */
          },
        },
      };
      plugin.attach(mockGrid as any);

      // Various lazy children indicators
      const rows = [
        { id: 1, name: 'Bool true', children: true },
        { id: 2, name: 'Number', children: 5 },
        { id: 3, name: 'Empty array', children: [] },
        { id: 4, name: 'No children' },
        { id: 5, name: 'False', children: false },
        { id: 6, name: 'Null', children: null },
      ];
      const processed = plugin.processRows(rows);

      expect(processed[0].__treeHasChildren).toBe(true); // true → lazy
      expect(processed[1].__treeHasChildren).toBe(true); // 5 → lazy
      expect(processed[2].__treeHasChildren).toBe(false); // [] → no children
      expect(processed[3].__treeHasChildren).toBe(false); // undefined → no children
      expect(processed[4].__treeHasChildren).toBe(false); // false → no children
      expect(processed[5].__treeHasChildren).toBe(false); // null → no children
    });
  });
});
