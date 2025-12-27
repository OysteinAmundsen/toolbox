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
      enabled: true,
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
      shadowRoot: null,
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
    const plugin = new TreePlugin({ enabled: false });

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
      shadowRoot: null,
    };
    plugin.attach(mockGrid as any);

    const cols = [{ field: 'name', header: 'Name' }];
    const processedCols = plugin.processColumns(cols);

    expect(processedCols[0].viewRenderer).toBeUndefined();
  });

  it('should correctly flatten rows after expansion toggle', () => {
    const config: TreeConfig = {
      enabled: true,
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
      shadowRoot: null,
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
      enabled: true,
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
    let dataRows = grid.shadowRoot?.querySelectorAll('.data-grid-row');
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
    dataRows = grid.shadowRoot?.querySelectorAll('.data-grid-row');
    expect(dataRows?.length).toBe(6);

    // Check that row order is correct by checking first cell of each row
    const firstCells = Array.from(dataRows!).map((row) =>
      row.querySelector('.cell[data-col="0"]')?.textContent?.trim()
    );

    // The name should appear after the tree toggle icon
    expect(firstCells).toEqual([
      expect.stringContaining('Documents'),
      expect.stringContaining('Resume.pdf'),
      expect.stringContaining('Cover Letter.docx'),
      expect.stringContaining('Projects'),
      expect.stringContaining('Pictures'),
      expect.stringContaining('readme.md'),
    ]);
  });
});
