import type { DataGridElement } from '../src/lib/core/grid';

/**
 * Wait for element upgrade and ready state
 */
export async function waitUpgrade(grid: DataGridElement): Promise<void> {
  await customElements.whenDefined('data-grid');
  if ('ready' in grid && typeof grid.ready === 'function') {
    await grid.ready();
  }
}

/**
 * Wait for next animation frame
 */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Create a grid element and append to body
 */
export function createGrid(): DataGridElement {
  const grid = document.createElement('data-grid') as DataGridElement;
  document.body.appendChild(grid);
  return grid;
}

/**
 * Create a requestAnimationFrame-based debounce wrapper. Consecutive calls in the same frame
 * cancel the previous scheduled callback ensuring it runs at most once per frame.
 */
export function rafDebounce<T extends (...args: unknown[]) => void>(fn: T) {
  let handle: number | null = null;
  const wrapped = (...args: Parameters<T>) => {
    if (handle != null) cancelAnimationFrame(handle);
    handle = requestAnimationFrame(() => {
      handle = null;
      fn(...args);
    });
  };
  (wrapped as unknown as { cancel: () => void }).cancel = () => {
    if (handle != null) cancelAnimationFrame(handle);
    handle = null;
  };
  return wrapped as T & { cancel: () => void };
}
