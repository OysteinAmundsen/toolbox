/**
 * Integration tests for TbwGrid that verify the runtime plumbing the
 * wrapper component is responsible for:
 *
 * 1. Mounting `<TeleportManager>` and registering it via `setTeleportManager`
 *    so cell/editor/detail/tool-panel renderers preserve the parent Vue
 *    context tree (provide/inject, Pinia, Router, i18n) instead of falling
 *    back to an isolated `createApp()` tree.
 * 2. Calling the grid's post-mount refresh hooks so framework children
 *    that mount after the grid's first light-DOM scan are picked up.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, inject, nextTick, type App } from 'vue';
import TbwGrid from './TbwGrid.vue';
import { getTeleportManager, renderToContainer } from './teleport-bridge';

describe('TbwGrid integration', () => {
  let mountEl: HTMLElement;
  let app: App;

  beforeEach(() => {
    mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
  });

  afterEach(() => {
    try {
      app?.unmount();
    } catch {
      /* ignore */
    }
    document.body.innerHTML = '';
  });

  it('should mount a TeleportManager and register it on the grid element', async () => {
    app = createApp({
      setup() {
        return () => h(TbwGrid, { rows: [] });
      },
    });
    app.mount(mountEl);

    // Wait for component lifecycle
    await nextTick();
    await nextTick();

    const gridEl = mountEl.querySelector('tbw-grid') as HTMLElement | null;
    expect(gridEl).not.toBeNull();

    const tm = getTeleportManager(gridEl!);
    expect(tm).not.toBeNull();
    expect(typeof tm!.renderTeleport).toBe('function');
  });

  it('should let teleport-bridge.renderToContainer preserve provide()d values', async () => {
    // This is the regression test for the silent-context-loss bug.
    // When TbwGrid does not mount a TeleportManager, renderToContainer
    // falls back to createApp() and inject() returns undefined.
    const provided = { value: 'context-preserved' };

    const Child = defineComponent({
      setup() {
        const v = inject<{ value: string }>('test-key', { value: 'fallback-no-context' });
        return () => h('span', { class: 'child' }, v.value);
      },
    });

    app = createApp({
      setup() {
        // Provide at the app root, above TbwGrid
        return () => h(TbwGrid, { rows: [] });
      },
    });
    app.provide('test-key', provided);
    app.mount(mountEl);

    await nextTick();
    await nextTick();

    const gridEl = mountEl.querySelector('tbw-grid') as HTMLElement | null;
    expect(gridEl).not.toBeNull();

    // Render a Vue component into a target container via the bridge,
    // simulating what an adapter renderer would do.
    const target = document.createElement('div');
    gridEl!.appendChild(target);

    renderToContainer(target, h(Child) as never, undefined, gridEl!);

    // Allow the TeleportManager's microtask flush + Vue render
    await new Promise((r) => queueMicrotask(r));
    await nextTick();
    await nextTick();

    expect(target.querySelector('.child')?.textContent).toBe('context-preserved');
  });

  it('should unregister the TeleportManager when TbwGrid is unmounted', async () => {
    app = createApp({
      setup() {
        return () => h(TbwGrid, { rows: [] });
      },
    });
    app.mount(mountEl);
    await nextTick();
    await nextTick();

    const gridEl = mountEl.querySelector('tbw-grid') as HTMLElement | null;
    expect(gridEl).not.toBeNull();
    expect(getTeleportManager(gridEl!)).not.toBeNull();

    app.unmount();
    expect(getTeleportManager(gridEl!)).toBeNull();
  });
});
