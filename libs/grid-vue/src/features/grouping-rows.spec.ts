/**
 * Tests for `@toolbox-web/grid-vue/features/grouping-rows`.
 *
 * Verifies the registered feature factory bridges Vue render-function returns
 * (`VNode`) for `groupRowRenderer` to vanilla `HTMLElement`, plus type-level
 * acceptance of `VNode` returns on `VueGroupingRowsConfig`.
 *
 * @vitest-environment jsdom
 */
import { createPluginFromFeature } from '@toolbox-web/grid/features/registry';
import type { GroupRowRenderParams } from '@toolbox-web/grid/plugins/grouping-rows';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { h, type VNode } from 'vue';
import type { VueGroupingRowsConfig } from '../lib/feature-props';
import './grouping-rows';

const sampleParams: GroupRowRenderParams = {
  key: 'Engineering',
  value: 'Engineering',
  depth: 0,
  rows: [],
  expanded: false,
  toggleExpand: () => undefined,
};

/** Reach the plugin's protected `userConfig` via a single typed assertion. */
const userConfigOf = <T>(plugin: unknown): T | undefined =>
  (plugin as { userConfig?: T } | null | undefined)?.userConfig;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('@toolbox-web/grid-vue/features/grouping-rows', () => {
  it('creates a GroupingRowsPlugin from `true`', () => {
    const plugin = createPluginFromFeature('groupingRows', true);
    expect(plugin).toBeDefined();
    expect((plugin as { name?: string } | undefined)?.name).toBe('groupingRows');
  });

  it('passes a config without a renderer through unchanged', () => {
    const plugin = createPluginFromFeature('groupingRows', {
      groups: [{ key: 'Engineering', value: 'Engineering' }],
    });
    expect(plugin).toBeDefined();
  });

  it('wraps a Vue groupRowRenderer to produce an HTMLElement', () => {
    const cfg: VueGroupingRowsConfig = {
      groupRowRenderer: (params) => h('strong', null, String(params.value)),
    };
    const plugin = createPluginFromFeature('groupingRows', cfg);
    const bridged = userConfigOf<{ groupRowRenderer?: (p: GroupRowRenderParams) => HTMLElement }>(
      plugin,
    )?.groupRowRenderer;
    expect(typeof bridged).toBe('function');
    expect(bridged!(sampleParams)).toBeInstanceOf(HTMLElement);
  });

  describe('types', () => {
    it('VueGroupingRowsConfig accepts a VNode-returning groupRowRenderer', () => {
      const cfg: VueGroupingRowsConfig = {
        groupRowRenderer: (params) => h('span', null, String(params.value)),
      };
      expectTypeOf(cfg.groupRowRenderer!).returns.toMatchTypeOf<VNode | HTMLElement | string | void>();
    });

    it('still accepts the vanilla HTMLElement / string signatures', () => {
      const cfg: VueGroupingRowsConfig = {
        groupRowRenderer: () => document.createElement('span'),
      };
      expect(cfg).toBeTruthy();
    });
  });
});
