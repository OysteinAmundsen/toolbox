import { describe, expectTypeOf, it } from 'vitest';
import type { ColumnConfig, GridConfig, NestedPaths } from '../index';

interface Deal {
  id: string;
  deal: { capture: { field: string }; otherStuff: { other: string } };
}

/**
 * Parity with core issue #438: the Angular adapter must accept nested dotted
 * paths in `field` by default AND support the strict `NestedPaths` opt-in
 * together with Angular component renderers.
 */
describe('nested dotted-path fields — Angular parity (#438)', () => {
  it('accepts nested paths by default (zero config)', () => {
    const columns: ColumnConfig<Deal>[] = [{ field: 'deal.capture.field' }, { field: 'deal.otherStuff.other' }];
    expectTypeOf(columns).toBeArray();
  });

  it('supports strict NestedPaths opt-in with the TField generic', () => {
    const config: GridConfig<Deal, NestedPaths<Deal>> = {
      columns: [{ field: 'deal.capture.field' }],
    };
    expectTypeOf(config.columns).toBeArray();
    expectTypeOf<'deal.capture.field'>().toMatchTypeOf<NestedPaths<Deal>>();
  });
});
