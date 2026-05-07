import { describe, expectTypeOf, it } from 'vitest';
import type { GridCellContext, GridEditorContext } from './context-types';

interface Row {
  id: string;
  name: string;
}

describe('GridCellContext generic defaults (issue #289 parity)', () => {
  it('defaults TValue to any so the value field needs no cast', () => {
    const ctx = {} as GridCellContext<any, Row>;
    const asString: string = ctx.value;
    const asNumber: number = ctx.value;
    void asString;
    void asNumber;
    expectTypeOf(ctx.row).toEqualTypeOf<Row>();
  });

  it('still accepts an explicit TValue', () => {
    const ctx = {} as GridCellContext<number, Row>;
    expectTypeOf(ctx.value).toEqualTypeOf<number>();
  });

  it('bare GridCellContext (no generics) resolves with any value', () => {
    const ctx = {} as GridCellContext;
    const anything: { foo: number } = ctx.value;
    void anything;
  });
});

describe('GridEditorContext generic defaults (issue #289 parity)', () => {
  it('defaults TValue to any so the value field needs no cast', () => {
    const ctx = {} as GridEditorContext<any, Row>;
    const asString: string = ctx.value;
    void asString;
    expectTypeOf(ctx.row).toEqualTypeOf<Row>();
    expectTypeOf(ctx.commit).parameters.toEqualTypeOf<[any]>();
  });
});
