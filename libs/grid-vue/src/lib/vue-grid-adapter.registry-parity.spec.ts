/**
 * Cross-adapter registry parity spec (gh #356 §8, post-cleanup).
 *
 * Asserts the Vue adapter exports exactly the registries its `<TbwGrid>`
 * shell actually invokes. Each adapter ships only the registries it uses —
 * "ship-without-caller" symmetry was removed in the post-#356 cleanup
 * because it created public API surface that nothing exercised. See the
 * cleanup DECIDED entry in `.github/knowledge/adapters.md`.
 *
 * Current per-adapter map:
 * - `registerEditorMountHook` — all 3 adapters (live)
 * - `registerPostMountRefresh` — React + Vue (live); Angular N/A
 *   (`ngAfterContentInit` covers the equivalent wiring)
 * - `registerChildFeatureDetector` — React only (live); Vue uses default
 *   slots, Angular uses attribute-selector directives
 * - `registerFeaturePropKey` — React + Vue (live); Angular uses per-feature
 *   `@Input()` directives
 * - `registerFeatureConfigPreprocessor` — Angular only (live, bridges
 *   TemplateRef / Component shapes); React/Vue need no such bridge
 */

import { describe, expect, it } from 'vitest';
import * as VueAdapter from '..';

describe('registry-parity (grid-vue)', () => {
  it('exports every registry the Vue shell uses', () => {
    expect(typeof VueAdapter.registerEditorMountHook).toBe('function');
    expect(typeof VueAdapter.registerPostMountRefresh).toBe('function');
    expect(typeof VueAdapter.registerFeaturePropKey).toBe('function');
  });

  it('does NOT export registries with no Vue caller (documents N/A intent)', () => {
    // Vue uses default slots (not child-component scans) and JSX-style
    // configs (no preprocessor bridging needed). If any of these appear
    // here, update the instructions file and the React/Angular parity
    // specs in the same PR.
    const adapter = VueAdapter as Record<string, unknown>;
    expect(adapter['registerChildFeatureDetector']).toBeUndefined();
    expect(adapter['registerFeatureConfigPreprocessor']).toBeUndefined();
    expect(adapter['getFeatureConfigPreprocessor']).toBeUndefined();
  });
});
