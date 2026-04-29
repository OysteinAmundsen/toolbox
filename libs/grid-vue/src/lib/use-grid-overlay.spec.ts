/**
 * Tests for the useGridOverlay composable (#251 Vue parity).
 *
 * @vitest-environment happy-dom
 */
import type { DataGridElement } from '@toolbox-web/grid';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, provide, ref, type Ref } from 'vue';
import { GRID_ELEMENT_KEY } from './use-grid';
import { useGridOverlay } from './use-grid-overlay';

interface MockGrid {
  registerExternalFocusContainer: ReturnType<typeof vi.fn>;
  unregisterExternalFocusContainer: ReturnType<typeof vi.fn>;
}

function createMockGrid(): MockGrid {
  return {
    registerExternalFocusContainer: vi.fn(),
    unregisterExternalFocusContainer: vi.fn(),
  };
}

interface MountOptions {
  open?: boolean;
  withGridContext?: MockGrid | null;
  withGridElementOption?: MockGrid | null;
}

interface MountResult {
  app: ReturnType<typeof createApp>;
  container: HTMLElement;
  panelRef: ReturnType<typeof ref<HTMLElement | null>>;
  setOpen: (v: boolean) => Promise<void>;
}

function mount(options: MountOptions = {}): MountResult {
  const open = ref(options.open ?? true);
  const panelRef = ref<HTMLElement | null>(null);
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(
    defineComponent({
      setup() {
        if (options.withGridContext !== undefined) {
          // null is allowed and represents an absent grid in context. The
          // mock implements only the two methods the composable touches;
          // cast the ref (single hop, no `as unknown as`) to satisfy the
          // InjectionKey's `Ref<DataGridElement | null>` contract.
          provide(GRID_ELEMENT_KEY, ref(options.withGridContext) as Ref<DataGridElement | null>);
        }
        const Child = defineComponent({
          setup() {
            const panel = ref<HTMLElement | null>(null);
            useGridOverlay(panel, {
              open,
              gridElement: options.withGridElementOption ?? undefined,
            });
            // Bridge inner ref to the outer one for assertions.
            return () => {
              const node = h('div', {
                ref: (el) => {
                  panel.value = el as HTMLElement | null;
                  panelRef.value = el as HTMLElement | null;
                },
              });
              return node;
            };
          },
        });
        return () => h(Child);
      },
    }),
  );

  app.mount(container);

  return {
    app,
    container,
    panelRef,
    setOpen: async (v) => {
      open.value = v;
      await nextTick();
      await nextTick();
    },
  };
}

describe('useGridOverlay (#251 Vue parity)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('registers panel via injected grid context when open=true', async () => {
    const grid = createMockGrid();
    const { app, panelRef } = mount({ open: true, withGridContext: grid });
    await nextTick();
    await nextTick();

    expect(panelRef.value).not.toBeNull();
    expect(grid.registerExternalFocusContainer).toHaveBeenCalledTimes(1);
    expect(grid.registerExternalFocusContainer).toHaveBeenCalledWith(panelRef.value);
    expect(grid.unregisterExternalFocusContainer).not.toHaveBeenCalled();

    app.unmount();
  });

  it('does not register when open=false', async () => {
    const grid = createMockGrid();
    const { app } = mount({ open: false, withGridContext: grid });
    await nextTick();
    await nextTick();

    expect(grid.registerExternalFocusContainer).not.toHaveBeenCalled();

    app.unmount();
  });

  it('unregisters when open toggles to false', async () => {
    const grid = createMockGrid();
    const { app, setOpen, panelRef } = mount({ open: true, withGridContext: grid });
    await nextTick();
    await nextTick();
    expect(grid.registerExternalFocusContainer).toHaveBeenCalledTimes(1);

    await setOpen(false);

    expect(grid.unregisterExternalFocusContainer).toHaveBeenCalledTimes(1);
    expect(grid.unregisterExternalFocusContainer).toHaveBeenCalledWith(panelRef.value);

    app.unmount();
  });

  it('unregisters on component unmount', async () => {
    const grid = createMockGrid();
    const { app, panelRef } = mount({ open: true, withGridContext: grid });
    await nextTick();
    await nextTick();

    const panelAtRegistration = panelRef.value;
    app.unmount();

    expect(grid.unregisterExternalFocusContainer).toHaveBeenCalledTimes(1);
    expect(grid.unregisterExternalFocusContainer).toHaveBeenCalledWith(panelAtRegistration);
  });

  it('prefers explicit gridElement option over context', async () => {
    const fromContext = createMockGrid();
    const fromOption = createMockGrid();
    const { app } = mount({
      open: true,
      withGridContext: fromContext,
      withGridElementOption: fromOption,
    });
    await nextTick();
    await nextTick();

    expect(fromOption.registerExternalFocusContainer).toHaveBeenCalledTimes(1);
    expect(fromContext.registerExternalFocusContainer).not.toHaveBeenCalled();

    app.unmount();
  });

  it('falls back to panel.closest("tbw-grid") when no context or option is provided', async () => {
    // Build a tbw-grid manually with stubbed register methods.
    const grid = document.createElement('tbw-grid') as HTMLElement & MockGrid;
    grid.registerExternalFocusContainer = vi.fn();
    grid.unregisterExternalFocusContainer = vi.fn();
    document.body.appendChild(grid);

    const open = ref(true);
    const panelRef = ref<HTMLElement | null>(null);
    const host = document.createElement('div');
    grid.appendChild(host);

    const app = createApp(
      defineComponent({
        setup() {
          // No provide() — context is empty.
          return () =>
            h('div', {
              ref: (el) => {
                panelRef.value = el as HTMLElement | null;
              },
            });
        },
      }),
    );
    app.mount(host);

    // Now run the composable in a fresh tree under the same DOM ancestry.
    const sub = createApp(
      defineComponent({
        setup() {
          const panel = ref<HTMLElement | null>(null);
          useGridOverlay(panel, { open });
          return () =>
            h('div', {
              ref: (el) => {
                panel.value = el as HTMLElement | null;
                panelRef.value = el as HTMLElement | null;
              },
            });
        },
      }),
    );
    const subHost = document.createElement('div');
    grid.appendChild(subHost);
    sub.mount(subHost);
    await nextTick();
    await nextTick();

    expect(grid.registerExternalFocusContainer).toHaveBeenCalledTimes(1);
    expect(grid.registerExternalFocusContainer).toHaveBeenCalledWith(panelRef.value);

    sub.unmount();
    app.unmount();
  });
});
