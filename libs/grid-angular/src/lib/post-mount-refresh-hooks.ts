/**
 * Post-mount refresh hook registry — Angular parallel of the React/Vue
 * adapters' `post-mount-refresh-hooks` registry.
 *
 * Angular does not currently *need* a post-mount refresh kick — its feature
 * bridges (`registerDetailRendererBridge`, `registerResponsiveCardRendererBridge`,
 * `registerTemplateBridge`) and `ngAfterContentInit` handle the equivalent
 * wiring. This registry exists to give feature secondary entries a stable
 * hook for future post-mount work (e.g. plugin instances created before a
 * `@ContentChild()` template is queried) and to maintain cross-adapter
 * surface parity with React/Vue (gh #356, §8).
 *
 * @packageDocumentation
 * @internal
 */

/**
 * Hook called after the `GridDirective` has finished its content-init pass.
 * The framework adapter is available on `gridEl.__frameworkAdapter` if the
 * hook needs it.
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
 * @internal `GridDirective` lifecycle use only.
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
