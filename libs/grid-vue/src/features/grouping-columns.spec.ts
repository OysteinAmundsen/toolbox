/**
 * Tests for `@toolbox-web/grid-vue/features/grouping-columns`.
 *
 * Verifies the registered feature factory bridges Vue render-function returns
 * (`VNode`) for `groupHeaderRenderer` and per-group `renderer` to vanilla
 * `HTMLElement`, plus type-level acceptance of `VNode` returns on
 * `VueGroupingColumnsConfig`.
 *
 * @vitest-environment jsdom
 */
import { createPluginFromFeature } from '@toolbox-web/grid/features/registry';
import type { GroupHeaderRenderParams } from '@toolbox-web/grid/plugins/grouping-columns';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import { h, type VNode } from 'vue';
import type {
  ColumnGroupDefinition as VueColumnGroupDefinition,
  GroupingColumnsConfig as VueGroupingColumnsConfig,
} from '../lib/feature-props';
import { resetBridge } from '../lib/teleport-bridge';
import './grouping-columns';

const sampleParams: GroupHeaderRenderParams = {
  id: 'personal',
  label: 'Personal',
  columns: [],
  firstIndex: 0,
  isImplicit: false,
};

/** Reach the plugin's protected `userConfig` via a single typed assertion. */
const userConfigOf = <T>(plugin: unknown): T | undefined =>
  (plugin as { userConfig?: T } | null | undefined)?.userConfig;

afterEach(() => {
  document.body.innerHTML = '';
  resetBridge();
});

beforeEach(() => {
  resetBridge();
});

describe('@toolbox-web/grid-vue/features/grouping-columns', () => {
  it('creates a GroupingColumnsPlugin from `true`', () => {
    const plugin = createPluginFromFeature('groupingColumns', true);
    expect(plugin).toBeDefined();
    expect((plugin as { name?: string } | undefined)?.name).toBe('groupingColumns');
  });

  it('passes a config without a renderer through unchanged', () => {
    const plugin = createPluginFromFeature('groupingColumns', {
      columnGroups: [{ id: 'g1', header: 'G1', children: ['a'] }],
    });
    expect(plugin).toBeDefined();
  });

  it('wraps a Vue groupHeaderRenderer to produce an HTMLElement', () => {
    const cfg: VueGroupingColumnsConfig = {
      groupHeaderRenderer: (params) => h('strong', null, params.label),
    };
    const plugin = createPluginFromFeature('groupingColumns', cfg);
    const bridged = userConfigOf<{ groupHeaderRenderer?: (p: GroupHeaderRenderParams) => HTMLElement }>(
      plugin,
    )?.groupHeaderRenderer;
    expect(typeof bridged).toBe('function');
    expect(bridged!(sampleParams)).toBeInstanceOf(HTMLElement);
  });

  it('wraps per-group renderer inside columnGroups to produce HTMLElement', () => {
    const cfg: VueGroupingColumnsConfig = {
      columnGroups: [
        {
          id: 'personal',
          header: 'Personal',
          children: ['firstName'],
          renderer: (params) => h('em', null, params.label),
        },
      ],
    };
    const plugin = createPluginFromFeature('groupingColumns', cfg);
    const groupRenderer = userConfigOf<{
      columnGroups?: Array<{ renderer?: (p: GroupHeaderRenderParams) => HTMLElement }>;
    }>(plugin)?.columnGroups?.[0]?.renderer;
    expect(typeof groupRenderer).toBe('function');
    expect(groupRenderer!(sampleParams)).toBeInstanceOf(HTMLElement);
  });

  describe('types', () => {
    it('VueGroupingColumnsConfig accepts a VNode-returning groupHeaderRenderer', () => {
      const cfg: VueGroupingColumnsConfig = {
        groupHeaderRenderer: (params) => h('span', null, params.label),
      };
      expectTypeOf(cfg.groupHeaderRenderer!).returns.toMatchTypeOf<VNode | HTMLElement | string | void>();
    });

    it('VueColumnGroupDefinition.renderer accepts a VNode return', () => {
      const def: VueColumnGroupDefinition = {
        id: 'g',
        header: 'G',
        children: ['a'],
        renderer: () => h('em', null, 'g'),
      };
      expect(typeof def.renderer).toBe('function');
    });

    it('still accepts the vanilla HTMLElement / string signatures', () => {
      const cfg: VueGroupingColumnsConfig = {
        groupHeaderRenderer: (params) => `<strong>${params.label}</strong>`,
        columnGroups: [
          {
            id: 'g',
            header: 'G',
            children: ['a'],
            renderer: () => document.createElement('span'),
          },
        ],
      };
      expect(cfg).toBeTruthy();
    });
  });
});
