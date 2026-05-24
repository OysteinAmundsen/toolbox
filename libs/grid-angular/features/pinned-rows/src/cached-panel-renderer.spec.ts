/**
 * Tests for the cached-panel-renderer helper used by
 * `@toolbox-web/grid-angular/features/pinned-rows` (#354).
 *
 * Focused on the caching invariant: the host element is stable across
 * renders, and after the first mount subsequent calls update component
 * inputs in place rather than mounting a fresh component.
 *
 * @vitest-environment jsdom
 */
import type { ComponentRef, Type } from '@angular/core';
import type { PinnedRowsContext } from '@toolbox-web/grid/plugins/pinned-rows';
import { describe, expect, it, vi } from 'vitest';
import { buildCachedPanelRenderer, mapPinnedRowsInputs, type PanelRendererAdapter } from './cached-panel-renderer';

function makeCtx(overrides: Partial<PinnedRowsContext> = {}): PinnedRowsContext {
  return {
    totalRows: 0,
    filteredRows: 0,
    selectedRows: 0,
    columns: [],
    rows: [],
    grid: document.createElement('div'),
    ...overrides,
  };
}

function makeAdapter(): {
  adapter: PanelRendererAdapter;
  mountSpy: ReturnType<typeof vi.fn>;
  setInputSpy: ReturnType<typeof vi.fn>;
  detectChangesSpy: ReturnType<typeof vi.fn>;
  hostElement: HTMLElement;
} {
  const hostElement = document.createElement('span');
  const setInputSpy = vi.fn();
  const detectChangesSpy = vi.fn();
  const componentRef = {
    setInput: setInputSpy,
    changeDetectorRef: { detectChanges: detectChangesSpy },
  } as unknown as ComponentRef<unknown>;
  const mountSpy = vi.fn(() => ({ hostElement, componentRef }));
  const adapter: PanelRendererAdapter = {
    mountComponentRenderer: <TCtx>(
      _componentClass: Type<unknown>,
      _mapInputs: (ctx: TCtx) => Record<string, unknown>,
    ) => mountSpy as (ctx: TCtx) => { hostElement: HTMLElement; componentRef: ComponentRef<unknown> },
  };
  return { adapter, mountSpy, setInputSpy, detectChangesSpy, hostElement };
}

class FakeComponent {}

describe('buildCachedPanelRenderer', () => {
  it('mounts the component once and returns its host element', () => {
    const { adapter, mountSpy, hostElement } = makeAdapter();
    const render = buildCachedPanelRenderer(adapter, FakeComponent as Type<unknown>);
    const out = render(makeCtx({ totalRows: 5 }));
    expect(out).toBe(hostElement);
    expect(mountSpy).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached host element across renders (no re-mount)', () => {
    const { adapter, mountSpy, hostElement } = makeAdapter();
    const render = buildCachedPanelRenderer(adapter, FakeComponent as Type<unknown>);
    const first = render(makeCtx({ totalRows: 5 }));
    const second = render(makeCtx({ totalRows: 6 }));
    const third = render(makeCtx({ totalRows: 7 }));
    expect(second).toBe(first);
    expect(third).toBe(hostElement);
    expect(mountSpy).toHaveBeenCalledTimes(1);
  });

  it('refreshes component inputs via setInput() on subsequent renders', () => {
    const { adapter, setInputSpy, detectChangesSpy } = makeAdapter();
    const render = buildCachedPanelRenderer(adapter, FakeComponent as Type<unknown>);
    render(makeCtx({ totalRows: 5, filteredRows: 5, selectedRows: 0 }));
    expect(setInputSpy).not.toHaveBeenCalled();
    expect(detectChangesSpy).not.toHaveBeenCalled();

    render(makeCtx({ totalRows: 10, filteredRows: 7, selectedRows: 2 }));
    // One setInput per mapped key.
    const inputNames = Object.keys(mapPinnedRowsInputs(makeCtx()));
    expect(setInputSpy).toHaveBeenCalledTimes(inputNames.length);
    expect(setInputSpy).toHaveBeenCalledWith('totalRows', 10);
    expect(setInputSpy).toHaveBeenCalledWith('filteredRows', 7);
    expect(setInputSpy).toHaveBeenCalledWith('selectedRows', 2);
    expect(detectChangesSpy).toHaveBeenCalledTimes(1);
  });

  it('separate factories cache independently', () => {
    const { adapter, mountSpy } = makeAdapter();
    const renderA = buildCachedPanelRenderer(adapter, FakeComponent as Type<unknown>);
    const renderB = buildCachedPanelRenderer(adapter, FakeComponent as Type<unknown>);
    renderA(makeCtx());
    renderA(makeCtx());
    renderB(makeCtx());
    renderB(makeCtx());
    expect(mountSpy).toHaveBeenCalledTimes(2);
  });
});

describe('mapPinnedRowsInputs', () => {
  it('extracts only the documented inputs', () => {
    const grid = document.createElement('div');
    const out = mapPinnedRowsInputs({
      totalRows: 3,
      filteredRows: 2,
      selectedRows: 1,
      columns: [],
      rows: [],
      grid,
    });
    expect(out).toEqual({
      totalRows: 3,
      filteredRows: 2,
      selectedRows: 1,
      columns: [],
      rows: [],
      grid,
    });
  });
});
