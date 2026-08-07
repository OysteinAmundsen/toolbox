/**
 * Cross-adapter drift guard for the feature key sets that React, Vue and
 * Angular actually extract at runtime (audit finding I1).
 *
 * React and Vue each have a compile-time guard that their own
 * `BUILTIN_FEATURE_PROP_KEYS` covers core `FeatureConfig`; Angular has none at
 * all. Nothing checked the three adapters against *each other*, so a feature
 * could be wired up in one and silently forgotten in another — the exact drift
 * the `new-adapter-feature` skill exists to prevent by hand. A key that is
 * typed on `FeatureProps` (or bound by a directive) but missing from the
 * extraction list is a silent runtime drop, not a documented limitation: the
 * generated API docs already advertise it.
 *
 * The sources are read as text rather than imported: adapter↔adapter imports
 * are banned by `no-restricted-imports`, and this is a source-level invariant
 * anyway.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Adapter = 'grid-react' | 'grid-vue' | 'grid-angular';

const ADAPTER_SRC = resolve(import.meta.dirname, '../../..');

/** Where each adapter enumerates the feature keys it extracts at runtime. */
const KEY_SOURCE: Record<Adapter, string> = {
  'grid-react': 'src/lib/feature-prop-keys.ts',
  'grid-vue': 'src/lib/feature-prop-keys.ts',
  'grid-angular': 'src/lib/directives/grid.directive.ts',
};

const ADAPTERS = Object.keys(KEY_SOURCE) as Adapter[];

/**
 * Per-adapter keys that are legitimately extracted by only that adapter —
 * genuinely framework-shaped features with no counterpart elsewhere (Angular
 * forms integration, React-only hook plumbing, …).
 *
 * Every entry must be justified by a DECIDED entry in
 * `.github/knowledge/adapters.md`. A feature that merely *hasn't been wired up
 * yet* does NOT belong here — that is the bug this spec exists to catch.
 */
const FRAMEWORK_SPECIFIC: Record<Adapter, readonly string[]> = {
  'grid-react': [],
  'grid-vue': [],
  'grid-angular': [],
};

function read(adapter: Adapter): string {
  return readFileSync(resolve(ADAPTER_SRC, adapter, KEY_SOURCE[adapter]), 'utf8');
}

function stringLiterals(source: string): string[] {
  return [...source.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function builtinKeys(source: string): string[] {
  const block = /const BUILTIN_FEATURE_PROP_KEYS[^=]*=\s*\[([\s\S]*?)\];/.exec(source);
  if (!block) throw new Error('BUILTIN_FEATURE_PROP_KEYS array literal not found');
  return stringLiterals(block[1]);
}

/** Angular has no key registry — `createFeaturePlugins` calls `addPlugin('x')` per feature. */
function addPluginKeys(source: string): string[] {
  const keys = [...source.matchAll(/addPlugin\('([^']+)'\)/g)].map((m) => m[1]);
  if (keys.length === 0) throw new Error("no addPlugin('…') calls found in grid.directive.ts");
  return keys;
}

function knownGaps(source: string): string[] {
  const block = /type _KnownBuiltinGaps\s*=\s*([^;]+);/.exec(source);
  if (!block) throw new Error('_KnownBuiltinGaps union not found');
  return stringLiterals(block[1]);
}

function extractedKeys(adapter: Adapter, source: string): string[] {
  return adapter === 'grid-angular' ? addPluginKeys(source) : builtinKeys(source);
}

describe('feature key parity (React ↔ Vue ↔ Angular)', () => {
  const sources = Object.fromEntries(ADAPTERS.map((a) => [a, read(a)])) as Record<Adapter, string>;

  const sharedKeys = (adapter: Adapter): string[] => {
    const specific = new Set(FRAMEWORK_SPECIFIC[adapter]);
    return [...new Set(extractedKeys(adapter, sources[adapter]))].filter((k) => !specific.has(k)).sort();
  };

  it('all three adapters extract the same feature key set', () => {
    const reference = sharedKeys('grid-react');
    expect(Object.fromEntries(ADAPTERS.map((a) => [a, sharedKeys(a)]))).toEqual(
      Object.fromEntries(ADAPTERS.map((a) => [a, reference])),
    );
  });

  it('no adapter enumerates the same key twice', () => {
    for (const adapter of ADAPTERS) {
      const keys = extractedKeys(adapter, sources[adapter]);
      expect({ [adapter]: new Set(keys).size }).toEqual({ [adapter]: keys.length });
    }
  });

  it('React and Vue agree on which keys are typed but deliberately not extracted', () => {
    expect(knownGaps(sources['grid-react']).sort()).toEqual(knownGaps(sources['grid-vue']).sort());
  });

  it('neither React nor Vue lists a key in both BUILTIN and _KnownBuiltinGaps', () => {
    for (const adapter of ['grid-react', 'grid-vue'] as const) {
      const builtin = new Set(builtinKeys(sources[adapter]));
      expect({ [adapter]: knownGaps(sources[adapter]).filter((k) => builtin.has(k)) }).toEqual({ [adapter]: [] });
    }
  });

  it('Angular does not extract a key React and Vue deliberately skip', () => {
    const gaps = new Set(knownGaps(sources['grid-react']));
    expect(addPluginKeys(sources['grid-angular']).filter((k) => gaps.has(k))).toEqual([]);
  });
});
