/**
 * Tests for the `GridConfig.locale` / `BaseGridPlugin.t()` localization mechanism.
 *
 * The design deliberately ships **no default locale map**: every call site
 * passes its English string inline as the fallback, so a plugin that is not
 * loaded costs nothing and an unmapped key silently stays English. These tests
 * pin that contract.
 *
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import type { GridLocale } from '../types';
import { BaseGridPlugin } from './base-plugin';

/** Minimal probe plugin that exposes the protected translation helpers. */
class ProbePlugin extends BaseGridPlugin {
  readonly name = 'probe';

  translateKey(key: string, fallback: string): string {
    return this.t(key, fallback);
  }

  get translateFn() {
    return this.translate;
  }
}

/**
 * Attach a probe plugin to a stub host exposing only `effectiveConfig`, which
 * is all `BaseGridPlugin.t()` reads.
 */
function makeProbe(locale?: GridLocale): ProbePlugin {
  const plugin = new ProbePlugin();
  (plugin as unknown as { grid: unknown }).grid = { effectiveConfig: { locale } };
  return plugin;
}

describe('GridConfig.locale', () => {
  it('returns the inline English fallback when no locale map is configured', () => {
    expect(makeProbe().translateKey('filter.apply', 'Apply')).toBe('Apply');
  });

  it('returns the inline fallback for a key the locale map does not define', () => {
    const probe = makeProbe({ 'filter.clear': 'Effacer' });
    expect(probe.translateKey('filter.apply', 'Apply')).toBe('Apply');
  });

  it('returns the configured translation when the key is defined', () => {
    const probe = makeProbe({ 'filter.apply': 'Appliquer' });
    expect(probe.translateKey('filter.apply', 'Apply')).toBe('Appliquer');
  });

  it('honours an empty string translation rather than falling back', () => {
    // `??` (not `||`) so a deliberately blank label is respected.
    const probe = makeProbe({ 'filter.apply': '' });
    expect(probe.translateKey('filter.apply', 'Apply')).toBe('');
  });

  it('falls back when the plugin is not attached to a grid', () => {
    const orphan = new ProbePlugin();
    expect(orphan.translateKey('filter.apply', 'Apply')).toBe('Apply');
  });

  it('exposes a bound `translate` function with the same semantics', () => {
    const probe = makeProbe({ 'pivot.grandTotal': 'Somme totale' });
    const t = probe.translateFn;
    expect(t('pivot.grandTotal', 'Grand Total')).toBe('Somme totale');
    expect(t('pivot.values', 'Values')).toBe('Values');
  });

  it('reads the locale map live, so a config change takes effect without re-attaching', () => {
    const probe = makeProbe({ 'filter.apply': 'Appliquer' });
    expect(probe.translateKey('filter.apply', 'Apply')).toBe('Appliquer');

    (probe as unknown as { grid: { effectiveConfig: { locale?: GridLocale } } }).grid.effectiveConfig.locale = {
      'filter.apply': 'Anwenden',
    };
    expect(probe.translateKey('filter.apply', 'Apply')).toBe('Anwenden');
  });
});
