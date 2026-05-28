/**
 * Tests for the config-level `cardRenderer` bridge added to
 * `@toolbox-web/grid-vue/features/responsive`.
 *
 * @vitest-environment jsdom
 */
import { createPluginFromFeature } from '@toolbox-web/grid/features/registry';
import type { ResponsivePluginConfig as CoreResponsivePluginConfig } from '@toolbox-web/grid/plugins/responsive';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { h } from 'vue';
import type { ResponsivePluginConfig } from '../lib/feature-props';
import { resetBridge } from '../lib/teleport-bridge';
import './responsive';

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

describe('@toolbox-web/grid-vue/features/responsive (config bridge)', () => {
  it('creates a plugin when given true', () => {
    const plugin = createPluginFromFeature('responsive', true);
    expect((plugin as { name?: string } | undefined)?.name).toBe('responsive');
  });

  it('passes a vanilla HTMLElement-returning cardRenderer through unchanged', () => {
    const vanilla: CoreResponsivePluginConfig['cardRenderer'] = () => {
      const el = document.createElement('section');
      el.textContent = 'vanilla card';
      return el;
    };
    const plugin = createPluginFromFeature('responsive', { cardRenderer: vanilla } as ResponsivePluginConfig);
    const bridged = userConfigOf<CoreResponsivePluginConfig>(plugin)?.cardRenderer;
    const out = bridged!({}, 0);
    expect(out).toBeInstanceOf(HTMLElement);
    expect(out.textContent).toBe('vanilla card');
  });

  it('bridges a VNode-returning cardRenderer to an HTMLElement host', () => {
    const cfg: ResponsivePluginConfig = { cardRenderer: (row) => h('span', JSON.stringify(row)) };
    const plugin = createPluginFromFeature('responsive', cfg);
    const bridged = userConfigOf<CoreResponsivePluginConfig>(plugin)?.cardRenderer;
    const out = bridged!({ id: 5 }, 0);
    expect(out).toBeInstanceOf(HTMLElement);
    expect(out.classList.contains('vue-responsive-card')).toBe(true);
  });

  it('does not throw on detach when VNode renderer was used', () => {
    const cfg: ResponsivePluginConfig = { cardRenderer: () => h('em', 'x') };
    const plugin = createPluginFromFeature('responsive', cfg);
    const bridged = userConfigOf<CoreResponsivePluginConfig>(plugin)?.cardRenderer;
    bridged!({}, 0);
    expect(() => detach(plugin)).not.toThrow();
  });
});
