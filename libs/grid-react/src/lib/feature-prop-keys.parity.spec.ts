/**
 * Cross-adapter drift guard for the React ↔ Vue feature prop-key registries
 * (audit finding I1).
 *
 * Each adapter already has a compile-time guard that its own
 * `BUILTIN_FEATURE_PROP_KEYS` covers core `FeatureConfig`. Nothing checked the
 * two adapters against *each other*, so a feature could be wired up in React
 * and silently forgotten in Vue (or vice versa) — the exact drift the
 * `new-adapter-feature` skill exists to prevent by hand.
 *
 * The sources are read as text rather than imported: adapter↔adapter imports
 * are banned by `no-restricted-imports`, and this is a source-level invariant
 * anyway.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ADAPTER_SRC = resolve(import.meta.dirname, '../../..');

function read(adapter: 'grid-react' | 'grid-vue'): string {
  return readFileSync(resolve(ADAPTER_SRC, adapter, 'src/lib/feature-prop-keys.ts'), 'utf8');
}

function stringLiterals(source: string): string[] {
  return [...source.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function builtinKeys(source: string): string[] {
  const block = /const BUILTIN_FEATURE_PROP_KEYS[^=]*=\s*\[([\s\S]*?)\];/.exec(source);
  if (!block) throw new Error('BUILTIN_FEATURE_PROP_KEYS array literal not found');
  return stringLiterals(block[1]);
}

function knownGaps(source: string): string[] {
  const block = /type _KnownBuiltinGaps\s*=\s*([^;]+);/.exec(source);
  if (!block) throw new Error('_KnownBuiltinGaps union not found');
  return stringLiterals(block[1]);
}

/**
 * Keys deliberately present in one adapter's BUILTIN list and not the other's.
 * See the `feature-prop-keys.ts` DECIDED entry in `.github/knowledge/adapters.md`.
 * Adding to this list requires a knowledge-base entry explaining why.
 */
const ACCEPTED_DIVERGENCE = ['rowDragDrop'];

describe('feature prop-key parity (React ↔ Vue)', () => {
  const react = read('grid-react');
  const vue = read('grid-vue');

  it('BUILTIN lists differ only by the accepted divergence', () => {
    const reactKeys = new Set(builtinKeys(react));
    const vueKeys = new Set(builtinKeys(vue));
    const onlyReact = [...reactKeys].filter((k) => !vueKeys.has(k));
    const onlyVue = [...vueKeys].filter((k) => !reactKeys.has(k));
    expect([...onlyReact, ...onlyVue].sort()).toEqual([...ACCEPTED_DIVERGENCE].sort());
  });

  it('BUILTIN ∪ gaps describes the same feature universe in both adapters', () => {
    const universe = (source: string) => [...new Set([...builtinKeys(source), ...knownGaps(source)])].sort();
    expect(universe(react)).toEqual(universe(vue));
  });

  it('neither adapter lists a key in both BUILTIN and _KnownBuiltinGaps', () => {
    for (const [name, source] of [
      ['react', react],
      ['vue', vue],
    ] as const) {
      const builtin = new Set(builtinKeys(source));
      expect({ [name]: knownGaps(source).filter((k) => builtin.has(k)) }).toEqual({ [name]: [] });
    }
  });
});
