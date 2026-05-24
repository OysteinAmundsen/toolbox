/**
 * Cross-adapter registry parity spec (gh #356 §8, post-cleanup).
 *
 * Asserts the Angular adapter exports exactly the registries its `Grid`
 * directive actually invokes. Each adapter ships only the registries it
 * uses — "ship-without-caller" symmetry was removed in the post-#356
 * cleanup because it created public API surface that nothing exercised.
 * See the cleanup DECIDED entry in `.github/knowledge/adapters.md`.
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
// `import '@angular/compiler'` is required because the primary entry
// transitively imports directives partially-compiled by ng-packagr; the
// conformance spec uses the same pattern.
import '@angular/compiler';
import * as AngularAdapter from '..';

describe('registry-parity (grid-angular)', () => {
  it('exports every registry the Angular adapter uses', () => {
    expect(typeof AngularAdapter.registerEditorMountHook).toBe('function');
    expect(typeof AngularAdapter.registerFeatureConfigPreprocessor).toBe('function');
    expect(typeof AngularAdapter.getFeatureConfigPreprocessor).toBe('function');
  });

  it('does NOT export React/Vue-only registries (documents N/A intent)', () => {
    // Angular uses attribute-selector directives + per-feature `@Input()`,
    // and `ngAfterContentInit` covers the post-mount-refresh wiring. If
    // any of these appear here, update the instructions file and the
    // React/Vue parity specs in the same PR.
    const adapter = AngularAdapter as Record<string, unknown>;
    expect(adapter['registerChildFeatureDetector']).toBeUndefined();
    expect(adapter['registerFeaturePropKey']).toBeUndefined();
    expect(adapter['registerPostMountRefresh']).toBeUndefined();
  });
});
