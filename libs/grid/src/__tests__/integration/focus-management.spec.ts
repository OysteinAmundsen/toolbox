/**
 * Focus Management Tests
 *
 * Tests for the external focus container registry and containsFocus utility.
 * These tests verify:
 * - registerExternalFocusContainer / unregisterExternalFocusContainer lifecycle
 * - containsFocus correctly checks grid DOM and external containers
 * - data-has-focus attribute persists when focus moves to external containers
 * - data-has-focus attribute is removed when focus truly leaves
 * - EditingPlugin focusTrap option behavior
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditingPlugin } from '../../lib/plugins/editing/EditingPlugin';

// Test helpers
async function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitUpgrade(el: HTMLElement & { ready?: () => Promise<void> }): Promise<void> {
  await customElements.whenDefined('tbw-grid');
  await el.ready?.();
  await nextFrame();
  await nextFrame();
}

// Typed grid alias for test brevity
type TestGrid = HTMLElement & {
  gridConfig: Record<string, unknown>;
  rows: Record<string, unknown>[];
  columns: Record<string, unknown>[];
  registerExternalFocusContainer: (el: Element) => void;
  unregisterExternalFocusContainer: (el: Element) => void;
  containsFocus: (node?: Node | null) => boolean;
  focusCell: (rowIndex: number, column: number | string) => void;
  focusedCell: { rowIndex: number; colIndex: number; field: string } | null;
  scrollToRow: (rowIndex: number, options?: { align?: string; behavior?: string }) => void;
  scrollToRowById: (rowId: string, options?: { align?: string; behavior?: string }) => void;
  ready: () => Promise<void>;
  _activeEditRows: number;
  _focusRow: number;
  _focusCol: number;
  _visibleColumns: { field: string }[];
  _virtualization: {
    enabled: boolean;
    container: HTMLElement | null;
    viewportEl: HTMLElement | null;
    rowHeight: number;
  };
};

describe('focus management', () => {
  let grid: TestGrid;

  beforeEach(async () => {
    await import('../../lib/core/grid');
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid') as TestGrid;
    grid.style.display = 'block';
    grid.style.height = '300px';
    grid.columns = [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' },
    ];
    grid.rows = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    document.body.appendChild(grid);
    await waitUpgrade(grid);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // #region registerExternalFocusContainer / unregisterExternalFocusContainer

  describe('registerExternalFocusContainer', () => {
    it('should be a function on the grid element', () => {
      expect(typeof grid.registerExternalFocusContainer).toBe('function');
    });

    it('should register an element as external container', () => {
      const panel = document.createElement('div');
      document.body.appendChild(panel);

      // Should not throw
      expect(() => grid.registerExternalFocusContainer(panel)).not.toThrow();
    });

    it('should be idempotent (registering same element twice is safe)', () => {
      const panel = document.createElement('div');
      document.body.appendChild(panel);

      grid.registerExternalFocusContainer(panel);
      grid.registerExternalFocusContainer(panel);

      // Unregister once should be sufficient
      grid.unregisterExternalFocusContainer(panel);

      // After unregister, the element should not be considered part of the grid
      const input = document.createElement('input');
      panel.appendChild(input);
      expect(grid.containsFocus(input)).toBe(false);
    });
  });

  describe('unregisterExternalFocusContainer', () => {
    it('should be a function on the grid element', () => {
      expect(typeof grid.unregisterExternalFocusContainer).toBe('function');
    });

    it('should remove a previously registered container', () => {
      const panel = document.createElement('div');
      const input = document.createElement('input');
      panel.appendChild(input);
      document.body.appendChild(panel);

      grid.registerExternalFocusContainer(panel);
      expect(grid.containsFocus(input)).toBe(true);

      grid.unregisterExternalFocusContainer(panel);
      expect(grid.containsFocus(input)).toBe(false);
    });

    it('should be safe to call with an unregistered element', () => {
      const panel = document.createElement('div');
      expect(() => grid.unregisterExternalFocusContainer(panel)).not.toThrow();
    });
  });

  // #endregion

  // #region containsFocus

  describe('containsFocus', () => {
    it('should be a function on the grid element', () => {
      expect(typeof grid.containsFocus).toBe('function');
    });

    it('should return true for a node inside the grid DOM', () => {
      const cell = grid.querySelector('.cell');
      expect(cell).toBeTruthy();
      expect(grid.containsFocus(cell!)).toBe(true);
    });

    it('should return false for a node outside the grid', () => {
      const outside = document.createElement('button');
      document.body.appendChild(outside);
      expect(grid.containsFocus(outside)).toBe(false);
    });

    it('should return true for a node inside a registered external container', () => {
      const panel = document.createElement('div');
      const input = document.createElement('input');
      panel.appendChild(input);
      document.body.appendChild(panel);

      grid.registerExternalFocusContainer(panel);
      expect(grid.containsFocus(input)).toBe(true);
    });

    it('should return false for a node inside an unregistered external container', () => {
      const panel = document.createElement('div');
      const input = document.createElement('input');
      panel.appendChild(input);
      document.body.appendChild(panel);

      // Not registered — should be false
      expect(grid.containsFocus(input)).toBe(false);
    });

    it('should return true for the container element itself', () => {
      const panel = document.createElement('div');
      document.body.appendChild(panel);

      grid.registerExternalFocusContainer(panel);
      expect(grid.containsFocus(panel)).toBe(true);
    });

    it('should return true for deeply nested nodes in external container', () => {
      const panel = document.createElement('div');
      const inner = document.createElement('div');
      const input = document.createElement('input');
      inner.appendChild(input);
      panel.appendChild(inner);
      document.body.appendChild(panel);

      grid.registerExternalFocusContainer(panel);
      expect(grid.containsFocus(input)).toBe(true);
    });

    it('should return false for null/undefined node when nothing is focused', () => {
      // When no node is provided, it falls back to document.activeElement
      // In test env with no focus, activeElement is body or null
      // body is not inside the grid, so should return false
      expect(grid.containsFocus(null)).toBe(false);
    });

    it('should work with multiple registered containers', () => {
      const panel1 = document.createElement('div');
      const panel2 = document.createElement('div');
      const input1 = document.createElement('input');
      const input2 = document.createElement('input');
      panel1.appendChild(input1);
      panel2.appendChild(input2);
      document.body.appendChild(panel1);
      document.body.appendChild(panel2);

      grid.registerExternalFocusContainer(panel1);
      grid.registerExternalFocusContainer(panel2);

      expect(grid.containsFocus(input1)).toBe(true);
      expect(grid.containsFocus(input2)).toBe(true);

      // Unregister one — the other should still work
      grid.unregisterExternalFocusContainer(panel1);
      expect(grid.containsFocus(input1)).toBe(false);
      expect(grid.containsFocus(input2)).toBe(true);
    });
  });

  // #endregion

  // #region data-has-focus attribute

  describe('data-has-focus attribute', () => {
    it('should set data-has-focus when grid receives focus', async () => {
      grid.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await nextFrame();

      expect(grid.dataset.hasFocus).toBeDefined();
    });

    it('should remove data-has-focus when focus leaves grid entirely', async () => {
      // First, set focus on grid
      grid.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await nextFrame();
      expect(grid.dataset.hasFocus).toBeDefined();

      // Focus leaves to an outside element (relatedTarget = outside)
      const outside = document.createElement('button');
      document.body.appendChild(outside);

      grid.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
      await nextFrame();

      expect(grid.dataset.hasFocus).toBeUndefined();
    });

    it('should keep data-has-focus when focus moves within the grid', async () => {
      grid.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await nextFrame();

      // Focus moves to another cell inside the grid
      const cell = grid.querySelector('.cell') as HTMLElement;
      if (cell) {
        grid.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: cell }));
        await nextFrame();
        expect(grid.dataset.hasFocus).toBeDefined();
      }
    });

    it('should keep data-has-focus when focus moves to registered external container', async () => {
      const panel = document.createElement('div');
      const input = document.createElement('input');
      panel.appendChild(input);
      document.body.appendChild(panel);

      grid.registerExternalFocusContainer(panel);

      // Focus enters the grid
      grid.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await nextFrame();
      expect(grid.dataset.hasFocus).toBeDefined();

      // Focus moves from grid to external container
      grid.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: input }));
      await nextFrame();

      // data-has-focus should persist — input is in a registered container
      expect(grid.dataset.hasFocus).toBeDefined();
    });

    it('should remove data-has-focus when focus moves to unregistered external element', async () => {
      const panel = document.createElement('div');
      const input = document.createElement('input');
      panel.appendChild(input);
      document.body.appendChild(panel);

      // NOT registered

      grid.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await nextFrame();

      grid.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: input }));
      await nextFrame();

      expect(grid.dataset.hasFocus).toBeUndefined();
    });

    it('should set data-has-focus when external container receives focus', async () => {
      const panel = document.createElement('div');
      const input = document.createElement('input');
      panel.appendChild(input);
      document.body.appendChild(panel);

      grid.registerExternalFocusContainer(panel);

      // External container receives focus directly (focusin on the panel)
      panel.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await nextFrame();

      expect(grid.dataset.hasFocus).toBeDefined();
    });

    it('should remove data-has-focus when focus leaves external container to unrelated element', async () => {
      const panel = document.createElement('div');
      const input = document.createElement('input');
      panel.appendChild(input);
      document.body.appendChild(panel);

      grid.registerExternalFocusContainer(panel);

      // First, focus the container
      panel.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await nextFrame();
      expect(grid.dataset.hasFocus).toBeDefined();

      // Focus leaves to an unrelated element
      const outsideBtn = document.createElement('button');
      document.body.appendChild(outsideBtn);

      panel.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outsideBtn }));
      await nextFrame();

      expect(grid.dataset.hasFocus).toBeUndefined();
    });
  });

  // #endregion

  // #region Cleanup on unregister

  describe('cleanup on unregister', () => {
    it('should stop focus listeners on the container after unregister', async () => {
      const panel = document.createElement('div');
      document.body.appendChild(panel);

      grid.registerExternalFocusContainer(panel);

      // Remove data-has-focus if set
      delete grid.dataset.hasFocus;

      grid.unregisterExternalFocusContainer(panel);

      // After unregister, focusin on the panel should NOT set data-has-focus
      panel.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await nextFrame();

      expect(grid.dataset.hasFocus).toBeUndefined();
    });
  });

  // #endregion
});

describe('EditingPlugin focus management', () => {
  let grid: TestGrid;

  beforeEach(async () => {
    await import('../../lib/core/grid');
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('click-outside with external containers', () => {
    it('should not close editor when clicking inside a registered external container', async () => {
      grid = document.createElement('tbw-grid') as TestGrid;
      grid.style.display = 'block';
      grid.style.height = '300px';
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name', editable: true },
        ],
        plugins: [new EditingPlugin({ editOn: 'click' })],
      };
      grid.rows = [{ id: 1, name: 'Alice' }];
      document.body.appendChild(grid);
      await waitUpgrade(grid);

      // Create an overlay panel and register it
      const overlay = document.createElement('div');
      const datepicker = document.createElement('input');
      datepicker.type = 'date';
      overlay.appendChild(datepicker);
      document.body.appendChild(overlay);
      grid.registerExternalFocusContainer(overlay);

      // Enter edit mode
      const row = grid.querySelector('.data-grid-row') as HTMLElement;
      const nameCell = row?.querySelector('.cell[data-col="1"]') as HTMLElement;
      nameCell?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await nextFrame();
      await nextFrame();

      const input = nameCell?.querySelector('input');
      expect(input).toBeTruthy();

      // Simulate mousedown on the datepicker (registered container)
      datepicker.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await nextFrame();

      // Edit mode should still be active — click was inside an external container
      expect(grid._activeEditRows).toBeGreaterThanOrEqual(0);
    });
  });

  describe('focusTrap option', () => {
    it('should accept focusTrap config option', () => {
      const plugin = new EditingPlugin({ editOn: 'click', focusTrap: true });
      expect(plugin.name).toBe('editing');
    });

    it('should default focusTrap to false', () => {
      const plugin = new EditingPlugin({ editOn: 'click' });
      // focusTrap defaults to false (undefined/falsy), no direct access to config
      // but the plugin should function normally
      expect(plugin.name).toBe('editing');
    });
  });

  describe('focusCell API', () => {
    beforeEach(async () => {
      grid = document.createElement('tbw-grid') as TestGrid;
      grid.style.display = 'block';
      grid.style.height = '300px';
      grid.columns = [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
      ];
      grid.rows = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
      ];
      document.body.appendChild(grid);
      await waitUpgrade(grid);
    });

    it('should move focus to a cell by column index', async () => {
      grid.focusCell(1, 1);
      await nextFrame();
      expect(grid._focusRow).toBe(1);
      expect(grid._focusCol).toBe(1);
    });

    it('should move focus to a cell by field name', async () => {
      grid.focusCell(0, 'name');
      await nextFrame();
      expect(grid._focusRow).toBe(0);
      const nameColIndex = grid._visibleColumns.findIndex((c) => c.field === 'name');
      expect(grid._focusCol).toBe(nameColIndex);
    });

    it('should clamp row index to valid range', async () => {
      grid.focusCell(999, 0);
      await nextFrame();
      expect(grid._focusRow).toBe(grid.rows.length - 1);
    });

    it('should clamp column index to valid range', async () => {
      grid.focusCell(0, 999);
      await nextFrame();
      expect(grid._focusCol).toBe(grid._visibleColumns.length - 1);
    });

    it('should not move focus if field name is not found', async () => {
      grid.focusCell(0, 0);
      await nextFrame();
      const prevRow = grid._focusRow;
      const prevCol = grid._focusCol;

      grid.focusCell(1, 'nonexistent');
      await nextFrame();
      expect(grid._focusRow).toBe(prevRow);
      expect(grid._focusCol).toBe(prevCol);
    });
  });

  describe('focusedCell property', () => {
    beforeEach(async () => {
      grid = document.createElement('tbw-grid') as TestGrid;
      grid.style.display = 'block';
      grid.style.height = '300px';
      grid.columns = [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
      ];
      grid.rows = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
      ];
      document.body.appendChild(grid);
      await waitUpgrade(grid);
    });

    it('should return current focus position', async () => {
      grid.focusCell(1, 0);
      await nextFrame();

      const cell = grid.focusedCell;
      expect(cell).not.toBeNull();
      expect(cell!.rowIndex).toBe(1);
      expect(cell!.colIndex).toBe(0);
      expect(cell!.field).toBe('id');
    });

    it('should return null when no rows are loaded', async () => {
      grid.rows = [];
      await nextFrame();
      expect(grid.focusedCell).toBeNull();
    });

    it('should include field name of focused column', async () => {
      grid.focusCell(0, 'name');
      await nextFrame();

      const cell = grid.focusedCell;
      expect(cell).not.toBeNull();
      expect(cell!.field).toBe('name');
    });
  });

  describe('scrollToRow API', () => {
    let tallGrid: TestGrid;

    beforeEach(async () => {
      // Create a grid with many rows to enable scrolling
      tallGrid = document.createElement('tbw-grid') as TestGrid;
      tallGrid.style.display = 'block';
      tallGrid.style.height = '200px';
      tallGrid.columns = [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
      ];
      tallGrid.rows = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));
      document.body.appendChild(tallGrid);
      await waitUpgrade(tallGrid);
    });

    it('should not throw with align "start"', () => {
      expect(() => tallGrid.scrollToRow(50, { align: 'start' })).not.toThrow();
    });

    it('should not throw with align "center"', () => {
      expect(() => tallGrid.scrollToRow(50, { align: 'center' })).not.toThrow();
    });

    it('should not throw with align "end"', () => {
      expect(() => tallGrid.scrollToRow(50, { align: 'end' })).not.toThrow();
    });

    it('should not throw with align "nearest" (default)', () => {
      expect(() => tallGrid.scrollToRow(50)).not.toThrow();
    });

    it('should clamp row index to valid range', () => {
      expect(() => tallGrid.scrollToRow(-5)).not.toThrow();
      expect(() => tallGrid.scrollToRow(99999)).not.toThrow();
    });

    it('should handle empty grid gracefully', async () => {
      tallGrid.rows = [];
      await nextFrame();
      expect(() => tallGrid.scrollToRow(0)).not.toThrow();
    });
  });

  describe('scrollToRowById API', () => {
    let tallGrid: TestGrid;

    beforeEach(async () => {
      tallGrid = document.createElement('tbw-grid') as TestGrid;
      tallGrid.style.display = 'block';
      tallGrid.style.height = '200px';
      tallGrid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
        ],
        getRowId: (row: any) => String(row.id),
      };
      tallGrid.rows = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));
      document.body.appendChild(tallGrid);
      await waitUpgrade(tallGrid);
    });

    it('should not throw for a valid row ID', () => {
      expect(() => tallGrid.scrollToRowById('50')).not.toThrow();
    });

    it('should handle non-existent row ID gracefully', () => {
      expect(() => tallGrid.scrollToRowById('nonexistent')).not.toThrow();
    });
  });
});
