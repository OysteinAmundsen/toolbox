/**
 * Post-mount refresh hook registry — keyed callbacks invoked once after the
 * React `<DataGrid>` has finished its initial mount, before the column /
 * shell-header `requestAnimationFrame` refresh.
 *
 * Each feature secondary entry (e.g. `@toolbox-web/grid-react/features/master-detail`
 * or `.../features/responsive`) registers under its feature name (matching
 * `keyof FeatureConfig`) so the `DataGrid` core no longer hard-codes which
 * plugins need a post-mount kick or what their refresh method is called.
 * Mirrors the existing `registerEditorMountHook` + bridge registries.
 *
 * Used to bridge the gap where a feature plugin is instantiated **before**
 * React commits its children (so the plugin can't see the render callbacks
 * registered by `<GridDetailPanel>` / `<GridResponsiveCard>`). The hook fires
 * once children are in the DOM and the registry has been populated.
 *
 * @packageDocumentation
 * @internal
 */

/**
 * Hook called after the React `<DataGrid>` has mounted its children.
 *
 * @param ctx.gridEl - The grid custom element. The framework adapter is
 *   available on `gridEl.__frameworkAdapter` if the hook needs it.
 */
export type PostMountRefreshHook = (ctx: { gridEl: HTMLElement }) => void;

const postMountRefreshHooks = new Map<string, PostMountRefreshHook>();

/**
 * Install a post-mount refresh hook keyed by feature name. Re-registering
 * with the same name replaces the previous hook (HMR-friendly). Called by
 * feature secondary entries on import.
 *
 * @internal Plugin API
 */
export function registerPostMountRefresh(name: string, hook: PostMountRefreshHook): void {
  postMountRefreshHooks.set(name, hook);
}

/**
 * Invoke every registered post-mount refresh hook in insertion order.
 *
 * @internal `<DataGrid>` mount-effect use only.
 */
export function notifyPostMount(gridEl: HTMLElement): void {
  for (const hook of postMountRefreshHooks.values()) {
    hook({ gridEl });
  }
}

/**
 * Test-only: clear all registered hooks. Lets specs assert in isolation.
 *
 * @internal
 */
export function clearPostMountRefreshHooks(): void {
  postMountRefreshHooks.clear();
}
