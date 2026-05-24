/**
 * @internal
 *
 * Cached panel-renderer factory for the Angular pinned-rows adapter (#354).
 *
 * Extracted into its own module so the pure caching logic can be unit-tested
 * without depending on the heavy `@toolbox-web/grid-angular` barrel (which
 * pulls in every directive at module-load and requires substantial Angular
 * DI mocking).
 *
 * @since 1.7.0
 */
import type { ComponentRef, Type } from '@angular/core';
import type { PinnedRowsContext } from '@toolbox-web/grid/plugins/pinned-rows';

/**
 * Minimal structural shape of the adapter API used by {@link buildCachedPanelRenderer}.
 * Mirrors `GridAdapter.mountComponentRenderer` without the rest of the surface
 * so tests can pass a stub.
 *
 * @internal
 */
export interface PanelRendererAdapter {
  mountComponentRenderer<TCtx>(
    componentClass: Type<unknown>,
    mapInputs: (ctx: TCtx) => Record<string, unknown>,
  ): (ctx: TCtx) => { hostElement: HTMLElement; componentRef: ComponentRef<unknown> };
}

/**
 * Map a {@link PinnedRowsContext} to the Angular component input bag.
 * Centralized so both the initial `mountComponentRenderer` call and the
 * per-call input-refresh path stay in sync.
 *
 * @internal
 */
export function mapPinnedRowsInputs(ctx: PinnedRowsContext): Record<string, unknown> {
  return {
    totalRows: ctx.totalRows,
    filteredRows: ctx.filteredRows,
    selectedRows: ctx.selectedRows,
    columns: ctx.columns,
    rows: ctx.rows,
    grid: ctx.grid,
  };
}

/**
 * Build a pinned-rows panel renderer function from an Angular component class.
 * The component should accept inputs from {@link PinnedRowsContext}.
 *
 * Caches the mounted component across renders — the pinned-rows plugin
 * (`renderPanelSlot`) reference-checks renderer outputs to skip DOM mutation
 * when nothing changed. On subsequent calls inputs are refreshed via
 * `componentRef.setInput()` instead of mounting a fresh component.
 *
 * The cached `ComponentRef` is tracked in the adapter's render pool, so it is
 * destroyed automatically when the grid is disposed.
 *
 * @internal
 */
export function buildCachedPanelRenderer(
  adapter: PanelRendererAdapter,
  componentClass: Type<unknown>,
): (ctx: PinnedRowsContext) => HTMLElement {
  const mount = adapter.mountComponentRenderer<PinnedRowsContext>(componentClass, mapPinnedRowsInputs);
  let cached: { hostElement: HTMLElement; componentRef: ComponentRef<unknown> } | null = null;
  return (ctx) => {
    if (!cached) {
      cached = mount(ctx);
      return cached.hostElement;
    }
    const inputs = mapPinnedRowsInputs(ctx);
    for (const name of Object.keys(inputs)) {
      cached.componentRef.setInput(name, inputs[name]);
    }
    cached.componentRef.changeDetectorRef.detectChanges();
    return cached.hostElement;
  };
}
