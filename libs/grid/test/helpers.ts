import type { DataGridElement } from '../src/lib/core/grid';

/**
 * Wait for `<tbw-grid>` to upgrade, finish `ready()`, and paint its first frames.
 */
export async function waitUpgrade(grid: HTMLElement & { ready?: () => Promise<void> }): Promise<void> {
  await customElements.whenDefined('tbw-grid');
  await grid.ready?.();
  await nextFrame();
  await nextFrame();
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
  const grid = document.createElement('tbw-grid') as DataGridElement;
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
