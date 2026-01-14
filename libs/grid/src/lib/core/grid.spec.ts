import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataGridElement } from './grid';

describe('DataGridElement', () => {
  beforeEach(() => {
    // Ensure custom element is defined
    if (!customElements.get('tbw-grid')) {
      customElements.define('tbw-grid', DataGridElement);
    }
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should create an tbw-grid element', () => {
    const grid = document.createElement('tbw-grid') as DataGridElement;
    expect(grid).toBeInstanceOf(DataGridElement);
  });

  it('should have shadow DOM', () => {
    const grid = document.createElement('tbw-grid') as DataGridElement;
    document.body.appendChild(grid);
    expect(grid.shadowRoot).toBeTruthy();
  });

  it('should resolve ready() promise when connected', async () => {
    const grid = document.createElement('tbw-grid') as DataGridElement;
    document.body.appendChild(grid);
    await expect(grid.ready()).resolves.toBeUndefined();
  });

  describe('Debug API', () => {
    it('should enable and disable debug mode', async () => {
      const grid = document.createElement('tbw-grid') as DataGridElement;
      document.body.appendChild(grid);
      await grid.ready();

      grid.setDebug(true);
      let info = grid.getDebugInfo();
      expect(info.debugEnabled).toBe(true);

      grid.setDebug(false);
      info = grid.getDebugInfo();
      expect(info.debugEnabled).toBe(false);
    });

    it('should return comprehensive debug info', async () => {
      const grid = document.createElement('tbw-grid') as DataGridElement;
      grid.rows = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];
      document.body.appendChild(grid);
      await grid.ready();

      const info = grid.getDebugInfo();

      // Check structure
      expect(info).toHaveProperty('debugEnabled');
      expect(info).toHaveProperty('connected');
      expect(info).toHaveProperty('initialized');
      expect(info).toHaveProperty('renderLog');
      expect(info).toHaveProperty('pendingRender');
      expect(info).toHaveProperty('virtualization');
      expect(info).toHaveProperty('columns');
      expect(info).toHaveProperty('rows');
      expect(info).toHaveProperty('plugins');
      expect(info).toHaveProperty('customStyles');

      // Check values
      expect(info.connected).toBe(true);
      expect(info.initialized).toBe(true);
      expect(info.rows.total).toBe(2);
      expect(info.columns.total).toBeGreaterThan(0);
    });

    it('should track render log when debug enabled', async () => {
      const grid = document.createElement('tbw-grid') as DataGridElement;
      document.body.appendChild(grid);
      await grid.ready();

      grid.setDebug(true);
      grid.clearDebugLog();

      // Trigger a render
      grid.rows = [{ id: 1, name: 'Test' }];
      await grid.forceLayout();

      const info = grid.getDebugInfo();
      expect(info.renderLog.length).toBeGreaterThan(0);
      expect(info.renderLog[0]).toHaveProperty('phase');
      expect(info.renderLog[0]).toHaveProperty('source');
      expect(info.renderLog[0]).toHaveProperty('timestamp');
    });

    it('should clear debug log', async () => {
      const grid = document.createElement('tbw-grid') as DataGridElement;
      document.body.appendChild(grid);
      await grid.ready();

      grid.setDebug(true);
      grid.rows = [{ id: 1 }];
      await grid.forceLayout();

      expect(grid.getDebugInfo().renderLog.length).toBeGreaterThan(0);

      grid.clearDebugLog();
      expect(grid.getDebugInfo().renderLog.length).toBe(0);
    });
  });
});
