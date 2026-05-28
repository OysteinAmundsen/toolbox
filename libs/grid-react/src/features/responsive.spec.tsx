/**
 * Tests for the config-level `cardRenderer` bridge added to
 * `@toolbox-web/grid-react/features/responsive`.
 *
 * Light-DOM `<GridResponsiveCard>` bridging is exercised in `grid-panels.spec.ts`.
 *
 * @vitest-environment jsdom
 */
import { createPluginFromFeature } from '@toolbox-web/grid/features/registry';
import type { ResponsivePluginConfig as CoreResponsivePluginConfig } from '@toolbox-web/grid/plugins/responsive';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ResponsivePluginConfig } from '../lib/feature-props';
import { resetBridge } from '../lib/portal-bridge';
import './responsive';

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

describe('@toolbox-web/grid-react/features/responsive (config bridge)', () => {
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
    expect(typeof bridged).toBe('function');
    const out = bridged!({}, 0);
    expect(out).toBeInstanceOf(HTMLElement);
    expect(out.textContent).toBe('vanilla card');
  });

  it('bridges a ReactNode-returning cardRenderer to an HTMLElement host', () => {
    const cfg: ResponsivePluginConfig = { cardRenderer: (row) => <span>{JSON.stringify(row)}</span> };
    const plugin = createPluginFromFeature('responsive', cfg);
    const bridged = userConfigOf<CoreResponsivePluginConfig>(plugin)?.cardRenderer;
    expect(typeof bridged).toBe('function');
    const out = bridged!({ id: 5 }, 0);
    expect(out).toBeInstanceOf(HTMLElement);
    expect(out.classList.contains('react-responsive-card')).toBe(true);
  });

  it('does not throw on detach when ReactNode renderer was used', () => {
    const cfg: ResponsivePluginConfig = { cardRenderer: () => <em>x</em> };
    const plugin = createPluginFromFeature('responsive', cfg);
    const bridged = userConfigOf<CoreResponsivePluginConfig>(plugin)?.cardRenderer;
    bridged!({}, 0);
    expect(() => detach(plugin)).not.toThrow();
  });
});
