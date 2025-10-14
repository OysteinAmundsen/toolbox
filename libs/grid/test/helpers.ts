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
