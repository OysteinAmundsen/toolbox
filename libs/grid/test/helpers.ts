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
 * Wait for the next animation frame, or for `frames` consecutive animation frames.
 */
export async function nextFrame(frames = 1): Promise<void> {
  for (let i = 0; i < frames; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
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

/**
 * Give `event` a spec-accurate `composedPath()`: the path from `target` up to
 * `window`, snapshotted NOW (before dispatch) and frozen for the event's life.
 *
 * happy-dom rebuilds `composedPath()` from the target's CURRENT ancestry on
 * every call, so a listener that detaches the target mid-bubble makes later
 * listeners see a one-node path — real browsers return the path as it was when
 * dispatch began (and `[]` once dispatch is over). Use this whenever a test
 * relies on the path surviving DOM mutation during dispatch.
 */
export function withDispatchPath<E extends Event>(event: E, target: EventTarget): E {
  const path: EventTarget[] = [];
  let node: Node | null = target as Node;
  while (node) {
    path.push(node);
    node = node.parentNode ?? ('host' in node ? (node as ShadowRoot).host : null);
  }
  if (typeof window !== 'undefined') path.push(window);
  Object.defineProperty(event, 'composedPath', { value: () => path.slice(), configurable: true });
  return event;
}
