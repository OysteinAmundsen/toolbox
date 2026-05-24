/**
 * Cross-adapter registry parity spec (gh #356 §8).
 *
 * Asserts every canonical registry name from the cross-adapter contract is
 * exported from the Angular adapter's primary entry. The React and Vue
 * adapters carry the same spec with the same registry names — if any
 * adapter drops one of these exports, this spec (or its peer in the other
 * adapter) fails.
 *
 * Per §8, applicability differs by adapter:
 * - `registerEditorMountHook` — all 3 adapters
 * - `registerPostMountRefresh` — all 3 adapters
 * - `registerFeatureConfigPreprocessor` / `getFeatureConfigPreprocessor` — all 3 adapters
 * - `registerChildFeatureDetector` — React + Vue only (Angular uses
 *   attribute-selector directives instead — N/A here)
 * - `registerFeaturePropKey` — React + Vue only (Angular has no `...rest`
 *   prop split; uses per-feature `@Input()` — N/A here)
 */

import { describe, expect, it } from 'vitest';
// `import '@angular/compiler'` is required because the primary entry
// transitively imports directives partially-compiled by ng-packagr; the
// conformance spec uses the same pattern.
import '@angular/compiler';
import * as AngularAdapter from '..';

describe('registry-parity (grid-angular)', () => {
  it('exports every cross-adapter registry from the primary entry', () => {
    expect(typeof AngularAdapter.registerEditorMountHook).toBe('function');
    expect(typeof AngularAdapter.registerPostMountRefresh).toBe('function');
    expect(typeof AngularAdapter.registerFeatureConfigPreprocessor).toBe('function');
    expect(typeof AngularAdapter.getFeatureConfigPreprocessor).toBe('function');
  });

  it('does NOT export React/Vue-only registries (documents N/A intent)', () => {
    // Angular uses attribute-selector directives + per-feature `@Input()`,
    // so these registries are intentionally absent. If they ever appear
    // here, the cross-adapter contract has drifted — update both the
    // instructions file and the React/Vue parity specs in the same PR.
    const adapter = AngularAdapter as Record<string, unknown>;
    expect(adapter['registerChildFeatureDetector']).toBeUndefined();
    expect(adapter['registerFeaturePropKey']).toBeUndefined();
  });
});
