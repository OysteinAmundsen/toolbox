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
import { BaseGridPlugin, type DataGridElement } from '@toolbox-web/grid';
import { registerFeature } from '@toolbox-web/grid/features/registry';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, inject, nextTick, reactive, ref, type App } from 'vue';
import '../features/filtering';
import TbwGrid from './TbwGrid.vue';
import { clearFeaturePropKeys, getFeaturePropKeys, registerFeaturePropKey } from './feature-prop-keys';
import type { FeatureName } from './feature-registry';
import { getTeleportManager, renderToContainer } from './teleport-bridge';

declare module '@toolbox-web/grid' {
  interface FeatureConfig<TRow> {
    auditFeature?: { prefix: string; options?: { label: string }; row?: TRow } | false;
  }
}

class AuditPlugin extends BaseGridPlugin<{ prefix: string; options?: { label: string } }> {
  readonly name = 'auditFeature';
}

describe('TbwGrid integration', () => {
  let mountEl: HTMLElement;
  let app: App;
  let featureKeys: readonly FeatureName[];

  beforeEach(() => {
    featureKeys = getFeaturePropKeys();
    mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
  });

  afterEach(() => {
    try {
      app?.unmount();
    } catch {
      /* ignore */
    }
    clearFeaturePropKeys();
    featureKeys.forEach(registerFeaturePropKey);
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

  it.each([false, undefined])('removes the last feature when filtering becomes %s', async (disabled) => {
    const filtering = ref<boolean | undefined>(true);
    app = createApp({
      setup: () => () => h(TbwGrid, { rows: [{ name: 'Alice' }], filtering: filtering.value }),
    });

    app.mount(mountEl);
    const grid = mountEl.querySelector('tbw-grid') as DataGridElement;
    await vi.waitFor(() => expect(grid.getPluginByName('filtering')).toBeDefined());

    filtering.value = disabled;
    await nextTick();
    await vi.waitFor(() => expect(grid.getPluginByName('filtering')).toBeUndefined());
  });

  it('uses registered third-party feature attributes without forwarding them to the DOM', async () => {
    const factory = vi.fn(
      (config: { prefix: string; options?: { label: string } } | false | undefined) => new AuditPlugin(config || {}),
    );
    registerFeature('auditFeature', factory, { override: true });
    registerFeaturePropKey('auditFeature');
    const original = reactive({ prefix: 'first' });
    const config = ref<{ prefix: string; options?: { label: string } } | false>(original);
    const extra = ref('kept');
    app = createApp({
      components: { TbwGrid },
      setup: () => ({ config, extra }),
      template: '<TbwGrid :audit-feature="config" :data-extra="extra" />',
    });
    app.mount(mountEl);
    const grid = mountEl.querySelector('tbw-grid') as DataGridElement;
    await vi.waitFor(() => expect(factory).toHaveBeenCalledWith({ prefix: 'first' }));
    expect(grid.getAttribute('audit-feature')).toBeNull();
    expect(grid.getAttribute('data-extra')).toBe('kept');
    expect(grid.getPluginByName('auditFeature')).toBeDefined();

    config.value = { prefix: 'second', options: { label: 'initial' } };
    await vi.waitFor(() =>
      expect((grid.getPluginByName('auditFeature') as AuditPlugin | undefined)?.resolvedConfig.prefix).toBe('second'),
    );
    const callsAfterReplacement = factory.mock.calls.length;
    original.prefix = 'obsolete';
    await nextTick();
    expect(factory).toHaveBeenCalledTimes(callsAfterReplacement);

    const callsBeforeMutation = factory.mock.calls.length;
    config.value.prefix = 'third';
    await vi.waitFor(() => expect(factory.mock.calls.length).toBeGreaterThan(callsBeforeMutation));
    await vi.waitFor(() =>
      expect((grid.getPluginByName('auditFeature') as AuditPlugin | undefined)?.resolvedConfig.prefix).toBe('third'),
    );

    const callsBeforeNestedMutation = factory.mock.calls.length;
    config.value.options!.label = 'updated';
    await vi.waitFor(() => expect(factory.mock.calls.length).toBeGreaterThan(callsBeforeNestedMutation));
    await vi.waitFor(() =>
      expect((grid.getPluginByName('auditFeature') as AuditPlugin | undefined)?.resolvedConfig.options?.label).toBe(
        'updated',
      ),
    );

    const calls = factory.mock.calls.length;
    extra.value = 'changed';
    await nextTick();
    expect(grid.getAttribute('data-extra')).toBe('changed');
    expect(factory).toHaveBeenCalledTimes(calls);

    config.value = false;
    await vi.waitFor(() => expect(grid.getPluginByName('auditFeature')).toBeUndefined());
  });

  it('accepts camel-case feature attributes and removes a feature when its attribute is removed', async () => {
    const factory = vi.fn(() => new AuditPlugin());
    registerFeature('auditFeature', factory, { override: true });
    registerFeaturePropKey('auditFeature');
    const enabled = ref(true);
    app = createApp({
      setup: () => () => h(TbwGrid, enabled.value ? { auditFeature: { prefix: 'camel' } } : {}),
    });
    app.mount(mountEl);
    const grid = mountEl.querySelector('tbw-grid') as DataGridElement;
    await vi.waitFor(() => expect(grid.getPluginByName('auditFeature')).toBeDefined());
    expect(factory).toHaveBeenCalledWith({ prefix: 'camel' });
    expect(grid.hasAttribute('auditfeature')).toBe(false);

    enabled.value = false;
    await vi.waitFor(() => expect(grid.getPluginByName('auditFeature')).toBeUndefined());
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

  it('normalizes column shorthand strings into ColumnConfig objects', async () => {
    app = createApp({
      setup() {
        return () =>
          h(TbwGrid, {
            rows: [],
            columns: ['id:number', 'firstName', 'email'] as unknown as never,
          });
      },
    });
    app.mount(mountEl);
    await nextTick();
    await nextTick();

    const gridEl = mountEl.querySelector('tbw-grid') as HTMLElement & {
      gridConfig?: { columns?: Array<{ field: string; header?: string; type?: string }> };
    };
    const cols = gridEl.gridConfig?.columns ?? [];
    expect(cols.length).toBe(3);
    expect(cols[0]).toMatchObject({ field: 'id', header: 'ID', type: 'number' });
    expect(cols[1]).toMatchObject({ field: 'firstName', header: 'First Name' });
    expect(cols[2]).toMatchObject({ field: 'email', header: 'Email' });
  });

  it('applies columnDefaults to every column; individual props override', async () => {
    app = createApp({
      setup() {
        return () =>
          h(TbwGrid, {
            rows: [],
            columns: [{ field: 'a' }, { field: 'b', sortable: false }] as unknown as never,
            columnDefaults: { sortable: true, resizable: true } as unknown as never,
          });
      },
    });
    app.mount(mountEl);
    await nextTick();
    await nextTick();

    const gridEl = mountEl.querySelector('tbw-grid') as HTMLElement & {
      gridConfig?: { columns?: Array<{ field: string; sortable?: boolean; resizable?: boolean }> };
    };
    const cols = gridEl.gridConfig?.columns ?? [];
    expect(cols[0]).toMatchObject({ field: 'a', sortable: true, resizable: true });
    // Individual prop wins over default
    expect(cols[1]).toMatchObject({ field: 'b', sortable: false, resizable: true });
  });
});

type DiffRow = { id: number; name: string };

/**
 * Smart row diffing: when `getRowId` is configured and only values changed
 * (same count, same IDs, same order), the adapter routes through
 * `grid.updateRows(..., 'sync')` instead of reassigning `grid.rows`. Structural
 * changes (add / remove / reorder) fall back to the full `grid.rows` replace.
 */
describe('TbwGrid smart row diffing', () => {
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

  async function mountWithSpies(initial: DiffRow[]) {
    const gridConfig = {
      columns: [{ field: 'id' }, { field: 'name' }],
      getRowId: (r: DiffRow) => String(r.id),
    };
    const rowsRef = ref<DiffRow[]>(initial);
    app = createApp({
      setup() {
        return () => h(TbwGrid, { rows: rowsRef.value, gridConfig });
      },
    });
    app.mount(mountEl);
    await nextTick();
    await nextTick();

    const gridEl = mountEl.querySelector('tbw-grid') as HTMLElement;
    expect(gridEl).not.toBeNull();

    // Record updateRows() calls (do not call through — we only assert routing).
    const updateRowsCalls: Array<[unknown, unknown]> = [];
    (gridEl as unknown as { updateRows: unknown }).updateRows = (updates: unknown, source?: unknown) => {
      updateRowsCalls.push([updates, source]);
    };

    // Count writes to the `rows` setter from this point (post-mount).
    let rowsSetCount = 0;
    const proto = Object.getPrototypeOf(gridEl);
    const desc = Object.getOwnPropertyDescriptor(proto, 'rows')!;
    Object.defineProperty(gridEl, 'rows', {
      configurable: true,
      get: desc.get,
      set(value) {
        rowsSetCount++;
        desc.set!.call(this, value);
      },
    });

    return {
      updateRowsCalls,
      getRowsSetCount: () => rowsSetCount,
      setRows: async (r: DiffRow[]) => {
        rowsRef.value = r;
        await nextTick();
        await nextTick();
      },
    };
  }

  it("routes a value-only change through updateRows(..., 'sync') without reassigning grid.rows", async () => {
    const spies = await mountWithSpies([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);

    await spies.setRows([
      { id: 1, name: 'A' },
      { id: 2, name: 'b' },
    ]);

    expect(spies.updateRowsCalls.length).toBe(1);
    expect(spies.updateRowsCalls[0][1]).toBe('sync');
    expect(spies.getRowsSetCount()).toBe(0);
  });

  it('falls back to grid.rows assignment for a structural change (reorder)', async () => {
    const spies = await mountWithSpies([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);

    await spies.setRows([
      { id: 2, name: 'b' },
      { id: 1, name: 'a' },
    ]);

    expect(spies.updateRowsCalls.length).toBe(0);
    expect(spies.getRowsSetCount()).toBeGreaterThan(0);
  });
});
