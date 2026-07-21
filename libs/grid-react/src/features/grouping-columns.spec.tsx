/**
 * Tests for `@toolbox-web/grid-react/features/grouping-columns`.
 *
 * Verifies the registered feature factory bridges React JSX `groupHeaderRenderer`
 * and per-group `renderer` returns to vanilla `HTMLElement`, plus type-level
 * acceptance of `ReactNode` returns on the `ReactGroupingColumnsConfig` surface.
 *
 * @vitest-environment jsdom
 */
import { createPluginFromFeature } from '@toolbox-web/grid/features/registry';
import type { GroupHeaderRenderParams } from '@toolbox-web/grid/plugins/grouping-columns';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import type {
  ColumnGroupDefinition as ReactColumnGroupDefinition,
  GroupingColumnsConfig as ReactGroupingColumnsConfig,
} from '../lib/feature-props';
import { resetBridge } from '../lib/portal-bridge';
import './grouping-columns';

const sampleParams: GroupHeaderRenderParams = {
  id: 'personal',
  label: 'Personal',
  columns: [],
  firstIndex: 0,
  isImplicit: false,
};

/** Reach the plugin's protected `userConfig` via a single typed assertion. */
const userConfigOf = <T,>(plugin: unknown): T | undefined =>
  (plugin as { userConfig?: T } | null | undefined)?.userConfig;

afterEach(() => {
  document.body.innerHTML = '';
  resetBridge();
});

beforeEach(() => {
  resetBridge();
});

describe('@toolbox-web/grid-react/features/grouping-columns', () => {
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

  it('wraps a React groupHeaderRenderer to produce an HTMLElement', () => {
    const captured: GroupHeaderRenderParams[] = [];
    const cfg: ReactGroupingColumnsConfig = {
      groupHeaderRenderer: (params) => {
        captured.push(params);
        return <span data-testid="group-header">{params.label}</span>;
      },
    };
    const plugin = createPluginFromFeature('groupingColumns', cfg);
    const bridged = userConfigOf<{ groupHeaderRenderer?: (p: GroupHeaderRenderParams) => HTMLElement }>(
      plugin,
    )?.groupHeaderRenderer;
    expect(typeof bridged).toBe('function');
    const out = bridged!(sampleParams);
    expect(out).toBeInstanceOf(HTMLElement);
    expect(captured).toHaveLength(1);
    expect(captured[0]?.label).toBe('Personal');
  });

  it('wraps per-group renderer inside columnGroups to produce HTMLElement', () => {
    const cfg: ReactGroupingColumnsConfig = {
      columnGroups: [
        {
          id: 'personal',
          header: 'Personal',
          children: ['firstName'],
          renderer: (params) => <em>{params.label}</em>,
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
    it('ReactGroupingColumnsConfig accepts a ReactNode-returning groupHeaderRenderer', () => {
      const cfg: ReactGroupingColumnsConfig = {
        groupHeaderRenderer: (params) => <span>{params.label}</span>,
      };
      expectTypeOf(cfg.groupHeaderRenderer!).returns.toMatchTypeOf<ReactNode | HTMLElement | string | void>();
    });

    it('ReactColumnGroupDefinition.renderer accepts a ReactNode return', () => {
      const def: ReactColumnGroupDefinition = {
        id: 'g',
        header: 'G',
        children: ['a'],
        renderer: () => <em>g</em>,
      };
      expect(typeof def.renderer).toBe('function');
    });

    it('still accepts the vanilla HTMLElement / string signatures', () => {
      const cfg: ReactGroupingColumnsConfig = {
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
