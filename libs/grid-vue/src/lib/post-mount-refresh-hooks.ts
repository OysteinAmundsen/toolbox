/**
 * Post-mount refresh hook registry — Vue parallel of
 * `@toolbox-web/grid-react`'s `post-mount-refresh-hooks`.
 *
 * Each feature secondary entry (e.g. `@toolbox-web/grid-vue/features/master-detail`
 * or `.../features/responsive`) registers under its feature name (matching
 * `keyof FeatureConfig`) so `TbwGrid.vue` no longer hard-codes which plugins
 * need a post-mount kick or what their refresh method is called.
 *
 * Fired from `onMounted`'s `nextTick` after Vue children render their light
 * DOM templates (`TbwGridDetailPanel`, `TbwGridResponsiveCard`, …).
 *
 * @packageDocumentation
 * @internal
 */

/**
 * Hook called after Vue has rendered the `<TbwGrid>` children. The framework
 * adapter is available on `gridEl.__frameworkAdapter` if the hook needs it.
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
 * @internal `TbwGrid` mount use only.
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
