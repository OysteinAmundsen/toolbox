/**
 * Test Helpers Unit Tests
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGrid, nextFrame, waitUpgrade } from './helpers';

// Mock the DataGridElement for testing
class MockDataGridElement extends HTMLElement {
  private _ready = false;
  private _readyPromise: Promise<void>;
  private _resolveReady!: () => void;

  constructor() {
    super();
    this._readyPromise = new Promise((resolve) => {
      this._resolveReady = resolve;
    });
  }

  ready(): Promise<void> {
    return this._readyPromise;
  }

  simulateReady(): void {
    this._ready = true;
    this._resolveReady();
  }
}

// Register mock element if not already defined
if (!customElements.get('data-grid')) {
  customElements.define('data-grid', MockDataGridElement);
}

describe('test helpers', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('waitUpgrade', () => {
    it('should wait for custom element to be defined', async () => {
      const grid = document.createElement('data-grid') as MockDataGridElement;
      document.body.appendChild(grid);

      // Simulate the grid becoming ready
      setTimeout(() => grid.simulateReady(), 10);

      await waitUpgrade(grid as any);

      // If we reach here without timeout, the test passes
      expect(true).toBe(true);
    });

    it('should call ready() if available on the element', async () => {
      const grid = document.createElement('data-grid') as MockDataGridElement;
      document.body.appendChild(grid);
      const readySpy = vi.spyOn(grid, 'ready');

      // Simulate the grid becoming ready
      setTimeout(() => grid.simulateReady(), 10);

      await waitUpgrade(grid as any);

      expect(readySpy).toHaveBeenCalled();
    });

    it('should handle elements without ready() method', async () => {
      const grid = document.createElement('data-grid') as any;
      delete grid.ready; // Remove ready method

      document.body.appendChild(grid);

      // Should not throw
      await waitUpgrade(grid);
      expect(true).toBe(true);
    });
  });

  describe('nextFrame', () => {
    it('should wait for next animation frame', async () => {
      let frameExecuted = false;

      requestAnimationFrame(() => {
        frameExecuted = true;
      });

      expect(frameExecuted).toBe(false);

      await nextFrame();

      expect(frameExecuted).toBe(true);
    });

    it('should return a promise that resolves after RAF', async () => {
      const promise = nextFrame();
      expect(promise).toBeInstanceOf(Promise);
      await promise;
    });
  });

  describe('createGrid', () => {
    it('should create a data-grid element', () => {
      const grid = createGrid();

      expect(grid.tagName.toLowerCase()).toBe('data-grid');
    });

    it('should append the grid to document body', () => {
      const grid = createGrid();

      expect(document.body.contains(grid)).toBe(true);
    });

    it('should return the created grid element', () => {
      const grid = createGrid();

      expect(grid).toBeTruthy();
      expect(grid instanceof HTMLElement).toBe(true);
    });
  });
});
