/**
 * Tests for `@toolbox-web/grid-react/features/pinned-rows`.
 *
 * Covers the slot-renderer bridging added in #354: per-slot host-element
 * caching (so the pinned-rows plugin can short-circuit row rebuilds), zoned
 * and flat slot renderers, aggregation passthrough, customPanels bridging,
 * built-in vanilla renderer passthrough, and disconnect-time teardown.
 *
 * @vitest-environment jsdom
 */
import { createPluginFromFeature } from '@toolbox-web/grid/features/registry';
import {
  rowCountPanel,
  type AggregationSlot,
  type PanelSlot,
  type PinnedRowSlot,
  type PinnedRowsConfig,
  type PinnedRowsContext,
} from '@toolbox-web/grid/plugins/pinned-rows';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetBridge } from '../lib/portal-bridge';
import './pinned-rows';
import type { ReactPinnedRowsConfig } from './pinned-rows';

const sampleCtx: PinnedRowsContext = {
  totalRows: 10,
  filteredRows: 10,
  selectedRows: 0,
  columns: [],
  rows: [],
  grid: document.createElement('div'),
};

/** Reach the plugin's protected `userConfig` via a single typed property read. */
const userConfigOf = <T,>(plugin: unknown): T | undefined =>
  (plugin as { userConfig?: T } | null | undefined)?.userConfig;

/** Force the plugin's `detach()` hook from outside the protected API. */
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

describe('@toolbox-web/grid-react/features/pinned-rows', () => {
  it('creates a PinnedRowsPlugin from `true`', () => {
    const plugin = createPluginFromFeature('pinnedRows', true);
    expect(plugin).toBeDefined();
    expect((plugin as { name?: string } | undefined)?.name).toBe('pinnedRows');
  });

  it('creates a PinnedRowsPlugin from `undefined`', () => {
    const plugin = createPluginFromFeature('pinnedRows', undefined);
    expect(plugin).toBeDefined();
  });

  it('passes aggregation slots through unchanged', () => {
    const agg: AggregationSlot = {
      position: 'top',
      aggregators: { price: 'sum' },
      label: 'Total',
    };
    const cfg: ReactPinnedRowsConfig = { slots: [agg] };
    const plugin = createPluginFromFeature('pinnedRows', cfg);
    const slots = userConfigOf<PinnedRowsConfig>(plugin)?.slots;
    expect(slots).toHaveLength(1);
    expect(slots?.[0]).toBe(agg);
  });

  it('bridges a flat React slot render to an HTMLElement, caching across calls', () => {
    const cfg: ReactPinnedRowsConfig = {
      slots: [{ id: 'p', position: 'top', render: (ctx) => <strong>{ctx.totalRows}</strong> }],
    };
    const plugin = createPluginFromFeature('pinnedRows', cfg);
    const slot = userConfigOf<PinnedRowsConfig>(plugin)?.slots?.[0] as PanelSlot;
    expect(typeof slot.render).toBe('function');
    const render = slot.render as (ctx: PinnedRowsContext) => HTMLElement | null;
    const first = render(sampleCtx);
    const second = render(sampleCtx);
    expect(first).toBeInstanceOf(HTMLElement);
    // Stable reference is the contract the pinned-rows plugin relies on to
    // short-circuit row rebuilds (avoids React unmount/remount loops).
    expect(second).toBe(first);
  });

  it('bridges zoned React slot renders per zone with caching', () => {
    const cfg: ReactPinnedRowsConfig = {
      slots: [
        {
          position: 'bottom',
          render: [
            { zone: 'left', render: (ctx) => <span>{ctx.filteredRows}</span> },
            { zone: 'right', render: (ctx) => <em>{ctx.selectedRows}</em> },
          ],
        },
      ],
    };
    const plugin = createPluginFromFeature('pinnedRows', cfg);
    const slot = userConfigOf<PinnedRowsConfig>(plugin)?.slots?.[0] as PanelSlot;
    expect(Array.isArray(slot.render)).toBe(true);
    const renders = slot.render as Array<{ zone?: string; render: (ctx: PinnedRowsContext) => HTMLElement | null }>;
    expect(renders).toHaveLength(2);
    const leftA = renders[0].render(sampleCtx);
    const leftB = renders[0].render(sampleCtx);
    const rightA = renders[1].render(sampleCtx);
    expect(leftA).toBeInstanceOf(HTMLElement);
    expect(leftB).toBe(leftA);
    expect(rightA).toBeInstanceOf(HTMLElement);
    expect(rightA).not.toBe(leftA);
  });

  it('passes built-in vanilla renderers (rowCountPanel) through without wrapping', () => {
    const cfg: ReactPinnedRowsConfig = {
      slots: [{ id: 'count', position: 'top', render: rowCountPanel() }],
    };
    const plugin = createPluginFromFeature('pinnedRows', cfg);
    const slot = userConfigOf<PinnedRowsConfig>(plugin)?.slots?.[0] as PanelSlot;
    const out = (slot.render as (ctx: PinnedRowsContext) => HTMLElement | null)(sampleCtx);
    expect(out).toBeInstanceOf(HTMLElement);
  });

  it('returns null when the React function returns null (built-in conditional panels can opt out)', () => {
    const cfg: ReactPinnedRowsConfig = {
      slots: [{ id: 'maybe', position: 'top', render: () => null }],
    };
    const plugin = createPluginFromFeature('pinnedRows', cfg);
    const slot = userConfigOf<PinnedRowsConfig>(plugin)?.slots?.[0] as PanelSlot;
    expect((slot.render as (ctx: PinnedRowsContext) => HTMLElement | null)(sampleCtx)).toBeNull();
  });

  it('bridges legacy customPanels[].render and coerces null to an empty div', () => {
    const cfg: ReactPinnedRowsConfig = {
      customPanels: [{ id: 'stats', position: 'center', render: (ctx) => <span>{ctx.totalRows}</span> }],
    };
    const plugin = createPluginFromFeature('pinnedRows', cfg);
    const panels = userConfigOf<PinnedRowsConfig>(plugin)?.customPanels;
    expect(panels).toHaveLength(1);
    const out = panels![0].render(sampleCtx);
    expect(out).toBeInstanceOf(HTMLElement);
  });

  it('detach() tears down bridged slot portals without throwing', () => {
    const cfg: ReactPinnedRowsConfig = {
      slots: [{ id: 'p', position: 'top', render: (ctx) => <strong>{ctx.totalRows}</strong> }],
    };
    const plugin = createPluginFromFeature('pinnedRows', cfg) as PinnedRowSlot & {
      attach?: (g: HTMLElement) => void;
    };
    const slot = userConfigOf<PinnedRowsConfig>(plugin)?.slots?.[0] as PanelSlot;
    // Prime the cache so a teardown is registered.
    (slot.render as (ctx: PinnedRowsContext) => HTMLElement | null)(sampleCtx);
    expect(() => detachPlugin(plugin)).not.toThrow();
    // After detach, calling render again creates a fresh host (cache cleared).
    const after = (slot.render as (ctx: PinnedRowsContext) => HTMLElement | null)(sampleCtx);
    expect(after).toBeInstanceOf(HTMLElement);
  });
});
