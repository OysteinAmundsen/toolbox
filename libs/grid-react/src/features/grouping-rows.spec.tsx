/**
 * Tests for `@toolbox-web/grid-react/features/grouping-rows`.
 *
 * Verifies the registered feature factory bridges React JSX `groupRowRenderer`
 * returns to vanilla `HTMLElement`, plus type-level acceptance of `ReactNode`
 * returns on the `ReactGroupingRowsConfig` surface.
 *
 * @vitest-environment jsdom
 */
import { createPluginFromFeature } from '@toolbox-web/grid/features/registry';
import type { GroupRowRenderParams } from '@toolbox-web/grid/plugins/grouping-rows';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import type { ReactGroupingRowsConfig } from '../lib/feature-props';
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
const userConfigOf = <T,>(plugin: unknown): T | undefined =>
  (plugin as { userConfig?: T } | null | undefined)?.userConfig;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('@toolbox-web/grid-react/features/grouping-rows', () => {
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

  it('wraps a React groupRowRenderer to produce an HTMLElement', () => {
    const cfg: ReactGroupingRowsConfig = {
      groupRowRenderer: (params) => <strong>{params.value}</strong>,
    };
    const plugin = createPluginFromFeature('groupingRows', cfg);
    const bridged = userConfigOf<{ groupRowRenderer?: (p: GroupRowRenderParams) => HTMLElement }>(
      plugin,
    )?.groupRowRenderer;
    expect(typeof bridged).toBe('function');
    expect(bridged!(sampleParams)).toBeInstanceOf(HTMLElement);
  });

  describe('types', () => {
    it('ReactGroupingRowsConfig accepts a ReactNode-returning groupRowRenderer', () => {
      const cfg: ReactGroupingRowsConfig = {
        groupRowRenderer: (params) => <span>{params.value}</span>,
      };
      expectTypeOf(cfg.groupRowRenderer!).returns.toMatchTypeOf<ReactNode | HTMLElement | string | void>();
    });

    it('still accepts the vanilla HTMLElement / string signatures', () => {
      const cfg: ReactGroupingRowsConfig = {
        groupRowRenderer: () => document.createElement('span'),
      };
      expect(cfg).toBeTruthy();
    });
  });
});
