import { describe, expect, it } from 'vitest';
import { BaseGridPlugin } from './base-plugin';

interface DemoConfig {
  items?: () => string[];
  label?: string;
}

class DemoPlugin extends BaseGridPlugin<DemoConfig> {
  readonly name = 'demo';
}

describe('BaseGridPlugin.refreshUserConfigFrom', () => {
  it('adopts the other instance’s userConfig', () => {
    const a = new DemoPlugin({ label: 'a' });
    const b = new DemoPlugin({ label: 'b', items: () => ['x'] });

    a.refreshUserConfigFrom(b);

    const cfg = (a as unknown as { userConfig: DemoConfig }).userConfig;
    expect(cfg.label).toBe('b');
    expect(cfg.items?.()).toEqual(['x']);
  });

  it('drops keys absent from the other instance’s userConfig', () => {
    const a = new DemoPlugin({ label: 'a', items: () => ['x'] });
    const b = new DemoPlugin({ label: 'b' });

    a.refreshUserConfigFrom(b);

    const cfg = (a as unknown as { userConfig: DemoConfig }).userConfig;
    expect(cfg.label).toBe('b');
    expect(cfg.items).toBeUndefined();
  });

  it('preserves config when both instances share the SAME userConfig object', () => {
    // A feature factory may store the consumer's config object by reference
    // (e.g. `new ContextMenuPlugin(config)`). When `gridConfig` is a recomputed
    // Angular `computed()` that passes the SAME config object across
    // re-resolutions, the cached and fresh plugin instances share one
    // `userConfig` reference. Refreshing must not wipe it. (#contextMenu)
    const shared: DemoConfig = { label: 'shared', items: () => ['keep'] };
    const cached = new DemoPlugin(shared);
    const fresh = new DemoPlugin(shared);

    cached.refreshUserConfigFrom(fresh);

    const cfg = (cached as unknown as { userConfig: DemoConfig }).userConfig;
    expect(cfg.label).toBe('shared');
    expect(cfg.items?.()).toEqual(['keep']);
  });
});
