/**
 * Test Helpers Unit Tests
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGrid, nextFrame, waitUpgrade } from './helpers';

/** Stand-in for `<tbw-grid>` whose `ready()` resolves only when the test says so. */
class MockGridElement extends HTMLElement {
  #resolveReady!: () => void;
  readonly #readyPromise = new Promise<void>((resolve) => {
    this.#resolveReady = resolve;
  });

  ready(): Promise<void> {
    return this.#readyPromise;
  }

  simulateReady(): void {
    this.#resolveReady();
  }
}

// `isolate: true` gives this file its own registry, so the mock never meets the real grid.
if (!customElements.get('tbw-grid')) {
  customElements.define('tbw-grid', MockGridElement);
}

const pendingGrid = (): MockGridElement => {
  const grid = new MockGridElement();
  document.body.appendChild(grid);
  return grid;
};

describe('test helpers', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('waitUpgrade', () => {
    it('resolves only after the element is defined and ready() has resolved', async () => {
      const grid = pendingGrid();
      let settled = false;
      const waiting = waitUpgrade(grid).then(() => {
        settled = true;
      });

      await nextFrame();
      expect(settled).toBe(false);

      grid.simulateReady();
      await waiting;
      expect(settled).toBe(true);
    });

    it('calls ready() when the element has it', async () => {
      const grid = pendingGrid();
      const readySpy = vi.spyOn(grid, 'ready');
      grid.simulateReady();

      await waitUpgrade(grid);

      expect(readySpy).toHaveBeenCalledOnce();
    });

    it('handles elements without a ready() method', async () => {
      const plain = document.createElement('div');
      document.body.appendChild(plain);

      await expect(waitUpgrade(plain)).resolves.toBeUndefined();
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
    it('should create a tbw-grid element', () => {
      const grid = createGrid();

      expect(grid.tagName.toLowerCase()).toBe('tbw-grid');
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
