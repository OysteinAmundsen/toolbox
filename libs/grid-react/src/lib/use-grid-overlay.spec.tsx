/**
 * Tests for the useGridOverlay hook (#251).
 *
 * @vitest-environment happy-dom
 */
import { createElement, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGridOverlay } from './use-grid-overlay';

// #region Test harness

interface FakeGrid extends HTMLElement {
  registerExternalFocusContainer: ReturnType<typeof vi.fn>;
  unregisterExternalFocusContainer: ReturnType<typeof vi.fn>;
}

function createFakeGrid(): FakeGrid {
  const el = document.createElement('tbw-grid') as FakeGrid;
  el.registerExternalFocusContainer = vi.fn();
  el.unregisterExternalFocusContainer = vi.fn();
  return el;
}

interface MountResult {
  panel: HTMLDivElement;
  container: HTMLDivElement;
  rerender: (open: boolean) => void;
  unmount: () => void;
}

function mountOverlay(grid: FakeGrid, initialOpen: boolean): MountResult {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const panel = document.createElement('div');
  // Simulate a portal: panel lives at <body>, but its ref is shared with
  // the React component that uses the hook. We pass `gridElement` to bypass
  // the closest('tbw-grid') resolution.
  document.body.appendChild(panel);

  let setOpen: ((value: boolean) => void) | null = null;

  function TestComponent({ open }: { open: boolean }) {
    const panelRef = useRef<HTMLDivElement | null>(panel);
    useGridOverlay(panelRef as RefObject<HTMLElement | null>, { open, gridElement: grid });
    return null;
  }

  const root = createRoot(container);
  flushSync(() => root.render(createElement(TestComponent, { open: initialOpen })));
  setOpen = (value) => flushSync(() => root.render(createElement(TestComponent, { open: value })));

  return {
    panel,
    container,
    rerender: (open) => setOpen?.(open),
    unmount: () => {
      flushSync(() => root.unmount());
      container.remove();
      panel.remove();
    },
  };
}

// #endregion

describe('useGridOverlay', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('registers the panel on mount when open=true', () => {
    const grid = createFakeGrid();
    const { panel, unmount } = mountOverlay(grid, true);

    expect(grid.registerExternalFocusContainer).toHaveBeenCalledTimes(1);
    expect(grid.registerExternalFocusContainer).toHaveBeenCalledWith(panel);
    expect(grid.unregisterExternalFocusContainer).not.toHaveBeenCalled();

    unmount();
  });

  it('does not register when open=false', () => {
    const grid = createFakeGrid();
    const { unmount } = mountOverlay(grid, false);

    expect(grid.registerExternalFocusContainer).not.toHaveBeenCalled();
    expect(grid.unregisterExternalFocusContainer).not.toHaveBeenCalled();

    unmount();
  });

  it('unregisters on unmount when previously open', () => {
    const grid = createFakeGrid();
    const { panel, unmount } = mountOverlay(grid, true);

    unmount();

    expect(grid.unregisterExternalFocusContainer).toHaveBeenCalledTimes(1);
    expect(grid.unregisterExternalFocusContainer).toHaveBeenCalledWith(panel);
  });

  it('registers/unregisters as open toggles', () => {
    const grid = createFakeGrid();
    const { panel, rerender, unmount } = mountOverlay(grid, true);

    expect(grid.registerExternalFocusContainer).toHaveBeenCalledTimes(1);

    rerender(false);
    expect(grid.unregisterExternalFocusContainer).toHaveBeenCalledTimes(1);
    expect(grid.unregisterExternalFocusContainer).toHaveBeenCalledWith(panel);

    rerender(true);
    expect(grid.registerExternalFocusContainer).toHaveBeenCalledTimes(2);

    unmount();
    expect(grid.unregisterExternalFocusContainer).toHaveBeenCalledTimes(2);
  });

  it('falls back to closest("tbw-grid") when gridElement option is omitted', () => {
    const grid = createFakeGrid();
    document.body.appendChild(grid);
    const panel = document.createElement('div');
    grid.appendChild(panel);

    const container = document.createElement('div');
    document.body.appendChild(container);

    function TestComponent() {
      const panelRef = useRef<HTMLDivElement | null>(panel);
      useGridOverlay(panelRef as RefObject<HTMLElement | null>);
      return null;
    }

    const root = createRoot(container);
    flushSync(() => root.render(createElement(TestComponent)));

    expect(grid.registerExternalFocusContainer).toHaveBeenCalledWith(panel);

    flushSync(() => root.unmount());
    container.remove();
  });
});
