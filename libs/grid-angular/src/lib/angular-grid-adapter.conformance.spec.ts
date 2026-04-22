/**
 * Adapter conformance — ensures the Angular adapter implements every
 * FrameworkAdapter hook that the grid core consumes. Prevents regressions
 * of the kind fixed in #237 (createToolPanelRenderer was silently absent
 * in Vue).
 *
 * The Angular adapter requires EnvironmentInjector / ApplicationRef /
 * ViewContainerRef to instantiate, so this spec inspects the prototype
 * instead of constructing an instance. This matches the rest of the
 * grid-angular spec suite which deliberately avoids TestBed.
 */
// Side-effect: loads the Angular JIT compiler so partially-compiled @angular/*
// libraries imported transitively by the adapter can be linked at test time.
// Required because the adapter's module graph pulls in @angular/forms via
// grid-form-array.directive.
import '@angular/compiler';

import { CORE_CONSUMED_ADAPTER_METHODS } from '@toolbox-web/grid';
import { describe, expect, it } from 'vitest';
import { GridAdapter } from './angular-grid-adapter';

describe('GridAdapter conformance', () => {
  it('implements every FrameworkAdapter hook the grid core consumes', () => {
    const proto = GridAdapter.prototype as unknown as Record<string, unknown>;
    const missing = CORE_CONSUMED_ADAPTER_METHODS.filter((m) => typeof proto[m] !== 'function');
    expect(missing).toEqual([]);
  });
});
