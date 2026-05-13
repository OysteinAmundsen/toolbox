/**
 * Tests for TeleportManager — the Vue component that renders content
 * into arbitrary DOM containers while preserving the parent Vue context tree.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, inject, provide, ref, type App } from 'vue';
import { TeleportManager, type TeleportManagerHandle } from './teleport-manager';

/** Helper to mount TeleportManager inside a parent Vue app and extract its handle. */
function mountTeleportManager(): { app: App; handle: TeleportManagerHandle; mountEl: HTMLElement } {
  const mountEl = document.createElement('div');
  document.body.appendChild(mountEl);

  let handle: TeleportManagerHandle | null = null;

  const app = createApp({
    setup() {
      const tmRef = ref<TeleportManagerHandle | null>(null);

      return () =>
        h(TeleportManager, {
          ref: (el: unknown) => {
            if (el && typeof el === 'object' && 'renderTeleport' in el) {
              tmRef.value = el as TeleportManagerHandle;
              handle = el as TeleportManagerHandle;
            }
          },
        });
    },
  });

  app.mount(mountEl);

  if (!handle) {
    throw new Error('TeleportManager handle was not exposed');
  }

  return { app, handle, mountEl };
}

describe('TeleportManager', () => {
  let app: App;
  let handle: TeleportManagerHandle;

  beforeEach(() => {
    const result = mountTeleportManager();
    app = result.app;
    handle = result.handle;
  });

  afterEach(() => {
    app.unmount();
    document.body.innerHTML = '';
  });

  // #region Core functionality

  describe('core functionality', () => {
    it('should expose renderTeleport, removeTeleport, and clear methods', () => {
      expect(typeof handle.renderTeleport).toBe('function');
      expect(typeof handle.removeTeleport).toBe('function');
      expect(typeof handle.clear).toBe('function');
    });

    it('should render VNode into target container after microtask flush', async () => {
      const target = document.createElement('div');
      document.body.appendChild(target);

      handle.renderTeleport('key1', target, h('span', 'hello'));

      // Wait for microtask flush
      await new Promise((r) => queueMicrotask(r));
      // Wait for Vue to render
      await new Promise((r) => setTimeout(r, 0));

      expect(target.textContent).toContain('hello');
    });

    it('should update existing teleport with new VNode', async () => {
      const target = document.createElement('div');
      document.body.appendChild(target);

      handle.renderTeleport('key1', target, h('span', 'first'));
      await new Promise((r) => queueMicrotask(r));
      await new Promise((r) => setTimeout(r, 0));

      handle.renderTeleport('key1', target, h('span', 'second'));
      await new Promise((r) => queueMicrotask(r));
      await new Promise((r) => setTimeout(r, 0));

      expect(target.textContent).toContain('second');
    });

    it('should remove teleport by key', async () => {
      const target = document.createElement('div');
      document.body.appendChild(target);

      handle.renderTeleport('key1', target, h('span', 'content'));
      await new Promise((r) => queueMicrotask(r));
      await new Promise((r) => setTimeout(r, 0));
      expect(target.textContent).toContain('content');

      handle.removeTeleport('key1');
      await new Promise((r) => queueMicrotask(r));
      await new Promise((r) => setTimeout(r, 0));

      expect(target.textContent).not.toContain('content');
    });

    it('should clear all teleports', async () => {
      const target1 = document.createElement('div');
      const target2 = document.createElement('div');
      document.body.appendChild(target1);
      document.body.appendChild(target2);

      handle.renderTeleport('key1', target1, h('span', 'a'));
      handle.renderTeleport('key2', target2, h('span', 'b'));
      await new Promise((r) => queueMicrotask(r));
      await new Promise((r) => setTimeout(r, 0));

      expect(target1.textContent).toContain('a');
      expect(target2.textContent).toContain('b');

      handle.clear();
      await new Promise((r) => queueMicrotask(r));
      await new Promise((r) => setTimeout(r, 0));

      expect(target1.textContent).not.toContain('a');
      expect(target2.textContent).not.toContain('b');
    });

    it('should handle removeTeleport for non-existent key', () => {
      expect(() => handle.removeTeleport('nonexistent')).not.toThrow();
    });
  });

  // #endregion

  // #region Batching

  describe('batching', () => {
    it('should batch multiple renders in a single microtask', async () => {
      const targets = Array.from({ length: 5 }, (_, _i) => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        return el;
      });

      // All synchronous — should batch into one update
      targets.forEach((t, i) => {
        handle.renderTeleport(`key${i}`, t, h('span', `item${i}`));
      });

      await new Promise((r) => queueMicrotask(r));
      await new Promise((r) => setTimeout(r, 0));

      targets.forEach((t, i) => {
        expect(t.textContent).toContain(`item${i}`);
      });
    });
  });

  // #endregion

  // #region Context preservation

  describe('context preservation', () => {
    it('should preserve provide/inject context in teleported content', async () => {
      // Clean up previous mount
      app.unmount();
      document.body.innerHTML = '';

      const parentMount = document.createElement('div');
      document.body.appendChild(parentMount);

      let capturedHandle: TeleportManagerHandle | null = null;
      const injectedValue = ref<string | undefined>(undefined);

      const ChildComponent = defineComponent({
        setup() {
          const val = inject<string>('testKey');
          injectedValue.value = val;
          return () => h('span', val ?? 'no-value');
        },
      });

      const parentApp = createApp({
        setup() {
          provide('testKey', 'provided-value');

          return () =>
            h(TeleportManager, {
              ref: (el: unknown) => {
                if (el && typeof el === 'object' && 'renderTeleport' in el) {
                  capturedHandle = el as TeleportManagerHandle;
                }
              },
            });
        },
      });

      parentApp.mount(parentMount);
      // Reassign for cleanup
      app = parentApp;

      expect(capturedHandle).not.toBeNull();

      const target = document.createElement('div');
      document.body.appendChild(target);

      capturedHandle!.renderTeleport('ctx-test', target, h(ChildComponent));
      await new Promise((r) => queueMicrotask(r));
      await new Promise((r) => setTimeout(r, 0));

      // The injected value should be available (context preserved via Teleport)
      expect(injectedValue.value).toBe('provided-value');
    });
  });

  // #endregion

  // #region Error boundary (#250 follow-up — Vue parity)

  describe('error boundary', () => {
    it('drops a teleport entry whose subtree throws during render', async () => {
      const target = document.createElement('div');
      document.body.appendChild(target);
      const otherTarget = document.createElement('div');
      document.body.appendChild(otherTarget);

      const Throws = defineComponent({
        setup() {
          throw new Error('boom from cell renderer');
        },
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      // Render a healthy entry alongside the throwing one.
      handle.renderTeleport('healthy', otherTarget, h('span', 'still here'));
      handle.renderTeleport('broken', target, h(Throws));

      await new Promise((r) => queueMicrotask(r));
      await new Promise((r) => setTimeout(r, 0));
      // The boundary's reactive state-change schedules another flush.
      await new Promise((r) => queueMicrotask(r));
      await new Promise((r) => setTimeout(r, 0));

      // Healthy teleport must still be visible.
      expect(otherTarget.textContent).toContain('still here');
      // Console got the diagnostic, including the entry key.
      expect(consoleSpy).toHaveBeenCalled();
      const message = consoleSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(message).toMatch(/broken/);
      // Removing the broken entry imperatively after the boundary already did
      // it must be a safe no-op (matches the React boundary contract).
      expect(() => handle.removeTeleport('broken')).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('does not bubble the captured error to the host app errorHandler', async () => {
      // Tear down the default fixture so we control errorHandler ourselves.
      app.unmount();

      const target = document.createElement('div');
      document.body.appendChild(target);
      const Throws = defineComponent({
        setup() {
          throw new Error('isolated throw');
        },
      });

      const hostHandler = vi.fn();
      const localApp = createApp({
        setup() {
          return () =>
            h(TeleportManager, {
              ref: (el: unknown) => {
                if (el && typeof el === 'object' && 'renderTeleport' in el) {
                  handle = el as TeleportManagerHandle;
                }
              },
            });
        },
      });
      localApp.config.errorHandler = hostHandler;

      const localMount = document.createElement('div');
      document.body.appendChild(localMount);
      localApp.mount(localMount);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      handle.renderTeleport('broken-2', target, h(Throws));
      await new Promise((r) => queueMicrotask(r));
      await new Promise((r) => setTimeout(r, 0));

      // The boundary returned false → host errorHandler must NOT be called.
      expect(hostHandler).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      localApp.unmount();
      // Recreate fixture for afterEach symmetry.
      const recreated = mountTeleportManager();
      app = recreated.app;
      handle = recreated.handle;
    });
  });

  // #endregion
});
