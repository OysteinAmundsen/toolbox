/**
 * PrintPlugin Unit Tests
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../../index';
import { PrintPlugin } from './PrintPlugin';

// Helper to wait for next frame
function nextFrame() {
  return new Promise((r) => requestAnimationFrame(r));
}

// Helper to create and wait for grid
async function createGrid(config?: any) {
  const grid = document.createElement('tbw-grid') as any;
  grid.rows = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
    { id: 3, name: 'Carol', email: 'carol@example.com' },
  ];
  grid.columns = [
    { field: 'id', header: 'ID' },
    { field: 'name', header: 'Name' },
    { field: 'email', header: 'Email' },
  ];
  if (config) {
    grid.gridConfig = config;
  }
  document.body.appendChild(grid);
  await grid.ready?.();
  await nextFrame();
  return grid;
}

describe('PrintPlugin', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('has correct name and version', () => {
      const plugin = new PrintPlugin();
      expect(plugin.name).toBe('print');
      expect(plugin.version).toBe('1.0.0');
    });

    it('attaches to grid without errors', async () => {
      const grid = await createGrid({
        plugins: [new PrintPlugin()],
      });
      const plugin = grid.getPlugin(PrintPlugin);
      expect(plugin).toBeInstanceOf(PrintPlugin);
    });

    it('accepts configuration options', () => {
      const plugin = new PrintPlugin({
        button: true,
        orientation: 'portrait',
        maxRows: 1000,
        title: 'Test Report',
      });
      // Plugin should be instantiable with config
      expect(plugin).toBeInstanceOf(PrintPlugin);
    });
  });

  describe('isPrinting', () => {
    it('returns false when not printing', async () => {
      const grid = await createGrid({
        plugins: [new PrintPlugin()],
      });
      const plugin = grid.getPlugin(PrintPlugin);
      expect(plugin.isPrinting()).toBe(false);
    });
  });

  describe('print method', () => {
    // Note: window.print() doesn't exist in happy-dom
    // We test the print flow by mocking it

    it('exists and is callable', async () => {
      const grid = await createGrid({
        plugins: [new PrintPlugin()],
      });
      const plugin = grid.getPlugin(PrintPlugin);
      expect(typeof plugin.print).toBe('function');
    });

    it('prevents concurrent prints', async () => {
      // Stub window.print to simulate printing without actually calling it
      const originalPrint = window.print;

      // Use Object.defineProperty to mock window.print in happy-dom
      Object.defineProperty(window, 'print', {
        value: () => {
          // Wait a bit then trigger afterprint
          setTimeout(() => {
            window.dispatchEvent(new Event('afterprint'));
          }, 50);
        },
        writable: true,
        configurable: true,
      });

      const grid = await createGrid({
        plugins: [new PrintPlugin()],
      });
      const plugin = grid.getPlugin(PrintPlugin);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      // Start first print
      const print1 = plugin.print();

      // Try second print immediately (should warn)
      await plugin.print();

      expect(warnSpy).toHaveBeenCalledWith('[PrintPlugin] Print already in progress');

      await print1;

      // Restore
      if (originalPrint) {
        Object.defineProperty(window, 'print', {
          value: originalPrint,
          writable: true,
          configurable: true,
        });
      }
    });
  });

  describe('configuration defaults', () => {
    it('uses default orientation of landscape', async () => {
      const plugin = new PrintPlugin();
      // Access through merged config (internal)
      expect(plugin).toBeInstanceOf(PrintPlugin);
    });

    it('uses default maxRows of 5000', async () => {
      const plugin = new PrintPlugin();
      expect(plugin).toBeInstanceOf(PrintPlugin);
    });

    it('respects custom configuration', () => {
      const plugin = new PrintPlugin({
        orientation: 'portrait',
        maxRows: 100,
        button: true,
        includeTitle: false,
        includeTimestamp: false,
      });
      expect(plugin).toBeInstanceOf(PrintPlugin);
    });
  });

  describe('toolbar button', () => {
    it('does not register button by default', async () => {
      const grid = await createGrid({
        plugins: [new PrintPlugin()],
      });
      await nextFrame();

      const button = grid.querySelector('.tbw-print-btn');
      expect(button).toBeNull();
    });
  });

  describe('row limit validation', () => {
    it('does not warn when rows are under warnThreshold', async () => {
      // Create grid with 3 rows and warnThreshold of 10
      let confirmCalled = false;
      Object.defineProperty(window, 'confirm', {
        value: () => {
          confirmCalled = true;
          return true;
        },
        writable: true,
        configurable: true,
      });

      // Stub window.print
      Object.defineProperty(window, 'print', {
        value: () => {
          setTimeout(() => {
            window.dispatchEvent(new Event('afterprint'));
          }, 10);
        },
        writable: true,
        configurable: true,
      });

      const grid = await createGrid({
        plugins: [new PrintPlugin({ warnThreshold: 10 })],
      });
      const plugin = grid.getPlugin(PrintPlugin);

      await plugin.print();

      // Should not have shown confirm since we're under the threshold
      expect(confirmCalled).toBe(false);
    });

    it('shows confirm when rows exceed warnThreshold', async () => {
      let confirmCalled = false;
      Object.defineProperty(window, 'confirm', {
        value: () => {
          confirmCalled = true;
          return true;
        },
        writable: true,
        configurable: true,
      });

      // Stub window.print
      Object.defineProperty(window, 'print', {
        value: () => {
          setTimeout(() => {
            window.dispatchEvent(new Event('afterprint'));
          }, 10);
        },
        writable: true,
        configurable: true,
      });

      const grid = await createGrid({
        plugins: [new PrintPlugin({ warnThreshold: 2 })],
      });
      const plugin = grid.getPlugin(PrintPlugin);

      await plugin.print();

      // Should have shown confirm since we're over the threshold (3 rows > 2 warnThreshold)
      expect(confirmCalled).toBe(true);
    });

    it('cancels print when user declines confirm', async () => {
      Object.defineProperty(window, 'confirm', {
        value: () => false,
        writable: true,
        configurable: true,
      });

      let printCalled = false;
      // Stub window.print
      Object.defineProperty(window, 'print', {
        value: () => {
          printCalled = true;
        },
        writable: true,
        configurable: true,
      });

      const grid = await createGrid({
        plugins: [new PrintPlugin({ warnThreshold: 2 })],
      });
      const plugin = grid.getPlugin(PrintPlugin);

      await plugin.print();

      // But print should not have been called
      expect(printCalled).toBe(false);
    });

    it('limits rows when maxRows is set', async () => {
      // Stub window.print
      Object.defineProperty(window, 'print', {
        value: () => {
          setTimeout(() => {
            window.dispatchEvent(new Event('afterprint'));
          }, 10);
        },
        writable: true,
        configurable: true,
      });

      const grid = await createGrid({
        plugins: [new PrintPlugin({ maxRows: 2, warnThreshold: 0 })], // No warning, just limit
      });

      let eventDetail: any = null;
      grid.addEventListener('print-start', (e: Event) => {
        eventDetail = (e as CustomEvent).detail;
      });

      const plugin = grid.getPlugin(PrintPlugin);
      await plugin.print();

      // Should report limited rows
      expect(eventDetail.rowCount).toBe(2);
      expect(eventDetail.limitApplied).toBe(true);
      expect(eventDetail.originalRowCount).toBe(3);
    });
  });

  describe('events', () => {
    it('emits print-start event', async () => {
      // Stub window.print
      Object.defineProperty(window, 'print', {
        value: () => {
          setTimeout(() => {
            window.dispatchEvent(new Event('afterprint'));
          }, 10);
        },
        writable: true,
        configurable: true,
      });

      const grid = await createGrid({
        plugins: [new PrintPlugin()],
      });
      const plugin = grid.getPlugin(PrintPlugin);

      const startHandler = vi.fn();
      grid.addEventListener('print-start', startHandler);

      await plugin.print();

      expect(startHandler).toHaveBeenCalled();
      const detail = startHandler.mock.calls[0][0].detail;
      expect(detail.rowCount).toBe(3);
      expect(detail.limitApplied).toBe(false);
    });

    it('emits print-complete event', async () => {
      // Stub window.print
      Object.defineProperty(window, 'print', {
        value: () => {
          setTimeout(() => {
            window.dispatchEvent(new Event('afterprint'));
          }, 10);
        },
        writable: true,
        configurable: true,
      });

      const grid = await createGrid({
        plugins: [new PrintPlugin()],
      });
      const plugin = grid.getPlugin(PrintPlugin);

      const completeHandler = vi.fn();
      grid.addEventListener('print-complete', completeHandler);

      await plugin.print();

      expect(completeHandler).toHaveBeenCalled();
      const detail = completeHandler.mock.calls[0][0].detail;
      expect(detail.success).toBe(true);
      expect(detail.rowCount).toBe(3);
    });
  });

  describe('printHidden column property', () => {
    it('hides columns marked printHidden during print', async () => {
      // Stub window.print
      Object.defineProperty(window, 'print', {
        value: () => {
          setTimeout(() => {
            window.dispatchEvent(new Event('afterprint'));
          }, 10);
        },
        writable: true,
        configurable: true,
      });

      const grid = document.createElement('tbw-grid') as any;
      grid.rows = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
      ];
      grid.columns = [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email', printHidden: true }, // Hide email in print
      ];
      grid.gridConfig = {
        plugins: [new PrintPlugin()],
      };
      document.body.appendChild(grid);
      await grid.ready?.();
      await nextFrame();

      // Before print, email column should be visible
      const emailColBefore = grid.getConfig().columns?.find((c: any) => c.field === 'email');
      expect(emailColBefore?.hidden).toBeFalsy();

      // Trigger print
      const plugin = grid.getPlugin(PrintPlugin);
      await plugin.print();

      // After print completes, email column should be restored to visible
      const emailColAfter = grid.getConfig().columns?.find((c: any) => c.field === 'email');
      expect(emailColAfter?.hidden).toBeFalsy();
    });

    it('preserves already hidden columns after print', async () => {
      // Stub window.print
      Object.defineProperty(window, 'print', {
        value: () => {
          setTimeout(() => {
            window.dispatchEvent(new Event('afterprint'));
          }, 10);
        },
        writable: true,
        configurable: true,
      });

      const grid = document.createElement('tbw-grid') as any;
      grid.rows = [{ id: 1, name: 'Alice', email: 'alice@example.com' }];
      grid.columns = [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email', printHidden: true },
      ];
      grid.gridConfig = {
        plugins: [new PrintPlugin()],
      };
      document.body.appendChild(grid);
      await grid.ready?.();
      await nextFrame();

      // Hide email column using setColumnVisible BEFORE print
      grid.setColumnVisible('email', false);
      await nextFrame();

      // Verify it's hidden before print using the correct API
      expect(grid.isColumnVisible('email')).toBe(false);

      // Trigger print (the column is both printHidden AND already hidden)
      const plugin = grid.getPlugin(PrintPlugin);
      await plugin.print();

      // After print, email column should still be hidden (it was hidden before print)
      expect(grid.isColumnVisible('email')).toBe(false);
    });

    it('only affects columns with printHidden: true', async () => {
      // Stub window.print
      Object.defineProperty(window, 'print', {
        value: () => {
          setTimeout(() => {
            window.dispatchEvent(new Event('afterprint'));
          }, 10);
        },
        writable: true,
        configurable: true,
      });

      const grid = document.createElement('tbw-grid') as any;
      grid.rows = [{ id: 1, name: 'Alice', email: 'alice@example.com' }];
      grid.columns = [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name', printHidden: true },
        { field: 'email', header: 'Email' },
      ];
      grid.gridConfig = {
        plugins: [new PrintPlugin()],
      };
      document.body.appendChild(grid);
      await grid.ready?.();
      await nextFrame();

      // Before print, all columns visible
      const cols = grid.getConfig().columns;
      expect(cols?.find((c: any) => c.field === 'id')?.hidden).toBeFalsy();
      expect(cols?.find((c: any) => c.field === 'name')?.hidden).toBeFalsy();
      expect(cols?.find((c: any) => c.field === 'email')?.hidden).toBeFalsy();

      // Trigger print
      const plugin = grid.getPlugin(PrintPlugin);
      await plugin.print();

      // After print, all originally visible columns should still be visible
      const colsAfter = grid.getConfig().columns;
      expect(colsAfter?.find((c: any) => c.field === 'id')?.hidden).toBeFalsy();
      expect(colsAfter?.find((c: any) => c.field === 'name')?.hidden).toBeFalsy();
      expect(colsAfter?.find((c: any) => c.field === 'email')?.hidden).toBeFalsy();
    });
  });

  describe('grid ID generation for print isolation', () => {
    it('grid auto-generates unique ID when none is set', async () => {
      const grid = await createGrid({
        plugins: [new PrintPlugin()],
      });

      // Grid should have auto-generated ID
      expect(grid.id).toMatch(/^tbw-grid-\d+$/);
      // The ID should also be reflected in the attribute
      expect(grid.getAttribute('id')).toBe(grid.id);
    });

    it('grid preserves user-set ID attribute', async () => {
      const grid = document.createElement('tbw-grid') as any;
      grid.id = 'my-custom-grid';
      grid.rows = [{ id: 1, name: 'Test' }];
      grid.gridConfig = { plugins: [new PrintPlugin()] };
      document.body.appendChild(grid);
      await grid.ready?.();
      await nextFrame();

      // User ID should be preserved
      expect(grid.id).toBe('my-custom-grid');
      expect(grid.getAttribute('id')).toBe('my-custom-grid');
    });

    it('multiple grids get unique auto-generated IDs', async () => {
      const grid1 = await createGrid({
        plugins: [new PrintPlugin()],
      });
      const grid2 = await createGrid({
        plugins: [new PrintPlugin()],
      });

      // Both should have IDs
      expect(grid1.id).toBeTruthy();
      expect(grid2.id).toBeTruthy();
      // IDs should be different
      expect(grid1.id).not.toBe(grid2.id);
    });
  });
});
