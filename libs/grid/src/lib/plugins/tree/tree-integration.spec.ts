import { describe, expect, it } from 'vitest';
import { TreePlugin } from './TreePlugin';
import type { TreeConfig } from './types';

describe('tree plugin integration', () => {
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
      dispatchEvent: () => { /* noop */ },
      requestRender: () => { /* noop */ },
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
      dispatchEvent: () => { /* noop */ },
      requestRender: () => { /* noop */ },
      rows: [],
      _columns: [],
      shadowRoot: null,
    };
    plugin.attach(mockGrid as any);

    const cols = [{ field: 'name', header: 'Name' }];
    const processedCols = plugin.processColumns(cols);

    expect(processedCols[0].viewRenderer).toBeUndefined();
  });
});
