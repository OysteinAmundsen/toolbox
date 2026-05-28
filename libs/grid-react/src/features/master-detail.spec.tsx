/**
 * Tests for the config-level `detailRenderer` bridge added to
 * `@toolbox-web/grid-react/features/master-detail`.
 *
 * Light-DOM `<GridDetailPanel>` bridging is exercised in `grid-panels.spec.ts`.
 *
 * @vitest-environment jsdom
 */
import { createPluginFromFeature } from '@toolbox-web/grid/features/registry';
import type { MasterDetailConfig as CoreMasterDetailConfig } from '@toolbox-web/grid/plugins/master-detail';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MasterDetailConfig } from '../lib/feature-props';
import { resetBridge } from '../lib/portal-bridge';
import './master-detail';

const userConfigOf = <T,>(plugin: unknown): T | undefined =>
  (plugin as { userConfig?: T } | null | undefined)?.userConfig;

const detach = (plugin: unknown): void => {
  (plugin as { detach?: () => void } | null | undefined)?.detach?.();
};

beforeEach(() => resetBridge());
afterEach(() => {
  document.body.innerHTML = '';
  resetBridge();
});

describe('@toolbox-web/grid-react/features/master-detail (config bridge)', () => {
  it('creates a plugin when given no config', () => {
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
    expect(typeof bridged).toBe('function');
    const out = bridged!({}, 0);
    expect(out).toBeInstanceOf(HTMLElement);
    expect((out as HTMLElement).textContent).toBe('vanilla');
  });

  it('bridges a ReactNode-returning detailRenderer to an HTMLElement host', () => {
    const cfg: MasterDetailConfig = { detailRenderer: (row) => <strong>{JSON.stringify(row)}</strong> };
    const plugin = createPluginFromFeature('masterDetail', cfg);
    const bridged = userConfigOf<CoreMasterDetailConfig>(plugin)?.detailRenderer;
    expect(typeof bridged).toBe('function');
    const out = bridged!({ id: 1 }, 0);
    expect(out).toBeInstanceOf(HTMLElement);
    expect((out as HTMLElement).classList.contains('react-detail-panel')).toBe(true);
  });

  it('passes a string return through unchanged', () => {
    const plugin = createPluginFromFeature('masterDetail', {
      detailRenderer: () => 'plain string',
    } as unknown as MasterDetailConfig);
    const bridged = userConfigOf<CoreMasterDetailConfig>(plugin)?.detailRenderer;
    const out = bridged!({}, 0);
    expect(out).toBe('plain string');
  });

  it('does not throw on detach when ReactNode renderer was used', () => {
    const cfg: MasterDetailConfig = { detailRenderer: () => <em>x</em> };
    const plugin = createPluginFromFeature('masterDetail', cfg);
    const bridged = userConfigOf<CoreMasterDetailConfig>(plugin)?.detailRenderer;
    bridged!({}, 0);
    expect(() => detach(plugin)).not.toThrow();
  });
});
