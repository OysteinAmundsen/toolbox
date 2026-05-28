/**
 * Tests for the config-level `detailRenderer` bridge added to
 * `@toolbox-web/grid-vue/features/master-detail`.
 *
 * @vitest-environment jsdom
 */
import { createPluginFromFeature } from '@toolbox-web/grid/features/registry';
import type { MasterDetailConfig as CoreMasterDetailConfig } from '@toolbox-web/grid/plugins/master-detail';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { h } from 'vue';
import type { MasterDetailConfig } from '../lib/feature-props';
import { resetBridge } from '../lib/teleport-bridge';
import './master-detail';

const userConfigOf = <T>(plugin: unknown): T | undefined =>
  (plugin as { userConfig?: T } | null | undefined)?.userConfig;

const detach = (plugin: unknown): void => {
  (plugin as { detach?: () => void } | null | undefined)?.detach?.();
};

beforeEach(() => resetBridge());
afterEach(() => {
  document.body.innerHTML = '';
  resetBridge();
});

describe('@toolbox-web/grid-vue/features/master-detail (config bridge)', () => {
  it('creates a plugin when given true', () => {
    const plugin = createPluginFromFeature('masterDetail', true);
    expect((plugin as { name?: string } | undefined)?.name).toBe('masterDetail');
  });

  it('passes a vanilla HTMLElement-returning detailRenderer through unchanged', () => {
    const vanilla: CoreMasterDetailConfig['detailRenderer'] = () => {
      const el = document.createElement('section');
      el.textContent = 'vanilla';
      return el;
    };
    const plugin = createPluginFromFeature('masterDetail', { detailRenderer: vanilla } as MasterDetailConfig);
    const bridged = userConfigOf<CoreMasterDetailConfig>(plugin)?.detailRenderer;
    const out = bridged!({}, 0);
    expect(out).toBeInstanceOf(HTMLElement);
    expect((out as HTMLElement).textContent).toBe('vanilla');
  });

  it('bridges a VNode-returning detailRenderer to an HTMLElement host', () => {
    const cfg: MasterDetailConfig = { detailRenderer: (row) => h('strong', JSON.stringify(row)) };
    const plugin = createPluginFromFeature('masterDetail', cfg);
    const bridged = userConfigOf<CoreMasterDetailConfig>(plugin)?.detailRenderer;
    const out = bridged!({ id: 1 }, 0);
    expect(out).toBeInstanceOf(HTMLElement);
    expect((out as HTMLElement).classList.contains('vue-detail-panel')).toBe(true);
  });

  it('passes a string return through unchanged', () => {
    const plugin = createPluginFromFeature('masterDetail', {
      detailRenderer: () => 'plain string',
    } as unknown as MasterDetailConfig);
    const bridged = userConfigOf<CoreMasterDetailConfig>(plugin)?.detailRenderer;
    const out = bridged!({}, 0);
    expect(out).toBe('plain string');
  });

  it('does not throw on detach when VNode renderer was used', () => {
    const cfg: MasterDetailConfig = { detailRenderer: () => h('em', 'x') };
    const plugin = createPluginFromFeature('masterDetail', cfg);
    const bridged = userConfigOf<CoreMasterDetailConfig>(plugin)?.detailRenderer;
    bridged!({}, 0);
    expect(() => detach(plugin)).not.toThrow();
  });
});
