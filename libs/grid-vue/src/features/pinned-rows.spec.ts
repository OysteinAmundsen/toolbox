/**
 * Tests for `@toolbox-web/grid-vue/features/pinned-rows`.
 *
 * Covers the slot-renderer bridging added in #354: per-slot host-element
 * caching, zoned and flat slot renderers, aggregation passthrough, customPanels
 * bridging, built-in vanilla renderer passthrough, and disconnect-time teardown.
 *
 * @vitest-environment jsdom
 */
import { createPluginFromFeature } from '@toolbox-web/grid/features/registry';
import {
  rowCountPanel,
  type AggregationSlot,
  type PanelSlot,
  type PinnedRowsConfig,
  type PinnedRowsContext,
} from '@toolbox-web/grid/plugins/pinned-rows';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { h } from 'vue';
import { resetBridge } from '../lib/teleport-bridge';
import './pinned-rows';
import type { VuePinnedRowsConfig } from './pinned-rows';

const sampleCtx: PinnedRowsContext = {
  totalRows: 10,
  filteredRows: 10,
  selectedRows: 0,
  columns: [],
  rows: [],
  grid: document.createElement('div'),
};

const userConfigOf = <T>(plugin: unknown): T | undefined =>
  (plugin as { userConfig?: T } | null | undefined)?.userConfig;

const detachPlugin = (plugin: unknown): void => {
  (plugin as { detach?: () => void } | null | undefined)?.detach?.();
};

beforeEach(() => {
  resetBridge();
});

afterEach(() => {
  document.body.innerHTML = '';
  resetBridge();
});

describe('@toolbox-web/grid-vue/features/pinned-rows', () => {
  it('creates a PinnedRowsPlugin from `true`', () => {
    const plugin = createPluginFromFeature('pinnedRows', true);
    expect(plugin).toBeDefined();
    expect((plugin as { name?: string } | undefined)?.name).toBe('pinnedRows');
  });

  it('passes aggregation slots through unchanged', () => {
    const agg: AggregationSlot = {
      position: 'top',
      aggregators: { price: 'sum' },
      label: 'Total',
    };
    const cfg: VuePinnedRowsConfig = { slots: [agg] };
    const plugin = createPluginFromFeature('pinnedRows', cfg);
    const slots = userConfigOf<PinnedRowsConfig>(plugin)?.slots;
    expect(slots).toHaveLength(1);
    expect(slots?.[0]).toBe(agg);
  });

  it('bridges a flat Vue slot render to an HTMLElement, caching across calls', () => {
    const cfg: VuePinnedRowsConfig = {
      slots: [{ id: 'p', position: 'top', render: (ctx) => h('strong', String(ctx.totalRows)) }],
    };
    const plugin = createPluginFromFeature('pinnedRows', cfg);
    const slot = userConfigOf<PinnedRowsConfig>(plugin)?.slots?.[0] as PanelSlot;
    const render = slot.render as (ctx: PinnedRowsContext) => HTMLElement | null;
    const first = render(sampleCtx);
    const second = render(sampleCtx);
    expect(first).toBeInstanceOf(HTMLElement);
    expect(second).toBe(first);
  });

  it('bridges zoned Vue slot renders per zone with caching', () => {
    const cfg: VuePinnedRowsConfig = {
      slots: [
        {
          position: 'bottom',
          render: [
            { zone: 'left', render: (ctx) => h('span', String(ctx.filteredRows)) },
            { zone: 'right', render: (ctx) => h('em', String(ctx.selectedRows)) },
          ],
        },
      ],
    };
    const plugin = createPluginFromFeature('pinnedRows', cfg);
    const slot = userConfigOf<PinnedRowsConfig>(plugin)?.slots?.[0] as PanelSlot;
    const renders = slot.render as Array<{ zone?: string; render: (ctx: PinnedRowsContext) => HTMLElement | null }>;
    expect(renders).toHaveLength(2);
    const leftA = renders[0].render(sampleCtx);
    const leftB = renders[0].render(sampleCtx);
    const rightA = renders[1].render(sampleCtx);
    expect(leftA).toBeInstanceOf(HTMLElement);
    expect(leftB).toBe(leftA);
    expect(rightA).not.toBe(leftA);
  });

  it('passes built-in vanilla renderers (rowCountPanel) through without wrapping', () => {
    const cfg: VuePinnedRowsConfig = {
      slots: [{ id: 'count', position: 'top', render: rowCountPanel() }],
    };
    const plugin = createPluginFromFeature('pinnedRows', cfg);
    const slot = userConfigOf<PinnedRowsConfig>(plugin)?.slots?.[0] as PanelSlot;
    const out = (slot.render as (ctx: PinnedRowsContext) => HTMLElement | null)(sampleCtx);
    expect(out).toBeInstanceOf(HTMLElement);
  });

  it('returns null when the Vue function returns null', () => {
    const cfg: VuePinnedRowsConfig = {
      slots: [{ id: 'maybe', position: 'top', render: () => null }],
    };
    const plugin = createPluginFromFeature('pinnedRows', cfg);
    const slot = userConfigOf<PinnedRowsConfig>(plugin)?.slots?.[0] as PanelSlot;
    expect((slot.render as (ctx: PinnedRowsContext) => HTMLElement | null)(sampleCtx)).toBeNull();
  });

  it('bridges legacy customPanels[].render to an HTMLElement', () => {
    const cfg: VuePinnedRowsConfig = {
      customPanels: [{ id: 'stats', position: 'center', render: (ctx) => h('span', String(ctx.totalRows)) }],
    };
    const plugin = createPluginFromFeature('pinnedRows', cfg);
    const panels = userConfigOf<PinnedRowsConfig>(plugin)?.customPanels;
    expect(panels).toHaveLength(1);
    expect(panels![0].render(sampleCtx)).toBeInstanceOf(HTMLElement);
  });

  it('detach() tears down bridged slot portals without throwing', () => {
    const cfg: VuePinnedRowsConfig = {
      slots: [{ id: 'p', position: 'top', render: (ctx) => h('strong', String(ctx.totalRows)) }],
    };
    const plugin = createPluginFromFeature('pinnedRows', cfg);
    const slot = userConfigOf<PinnedRowsConfig>(plugin)?.slots?.[0] as PanelSlot;
    (slot.render as (ctx: PinnedRowsContext) => HTMLElement | null)(sampleCtx);
    expect(() => detachPlugin(plugin)).not.toThrow();
    const after = (slot.render as (ctx: PinnedRowsContext) => HTMLElement | null)(sampleCtx);
    expect(after).toBeInstanceOf(HTMLElement);
  });
});
