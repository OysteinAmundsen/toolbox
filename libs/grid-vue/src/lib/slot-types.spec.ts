import { describe, expectTypeOf, it } from 'vitest';
import type { CellSlotProps, EditorSlotProps, GridCellContext, GridEditorContext } from './slot-types';

interface Row {
  id: string;
  name: string;
}

describe('CellSlotProps generic defaults (issue #289)', () => {
  it('defaults TValue to any so single-generic usage compiles', () => {
    // Specifying only TRow must not error when assigning the value to a typed variable.
    const ctx = {} as CellSlotProps<Row>;
    // `value` is `any` → assignable to anything (regression: was `unknown`, required cast)
    const asString: string = ctx.value;
    const asNumber: number = ctx.value;
    void asString;
    void asNumber;
    expectTypeOf(ctx.row).toEqualTypeOf<Row>();
  });

  it('still accepts an explicit TValue', () => {
    const ctx = {} as CellSlotProps<Row, number>;
    expectTypeOf(ctx.value).toEqualTypeOf<number>();
  });

  it('GridCellContext alias defaults TValue to any', () => {
    const ctx = {} as GridCellContext<any, Row>;
    const asString: string = ctx.value;
    void asString;
    // Bare `GridCellContext` (no generics) must also resolve, per react parity.
    const bare = {} as GridCellContext;
    const anything: { foo: number } = bare.value;
    void anything;
  });
});

describe('EditorSlotProps generic defaults (issue #289)', () => {
  it('defaults TValue to any so single-generic usage compiles', () => {
    const ctx = {} as EditorSlotProps<Row>;
    const asString: string = ctx.value;
    void asString;
    expectTypeOf(ctx.row).toEqualTypeOf<Row>();
    // `commit` accepts any value when TValue defaults to `any`
    expectTypeOf(ctx.commit).parameters.toEqualTypeOf<[any]>();
  });

  it('GridEditorContext alias defaults TValue to any', () => {
    const ctx = {} as GridEditorContext<any, Row>;
    const asString: string = ctx.value;
    void asString;
  });
});
