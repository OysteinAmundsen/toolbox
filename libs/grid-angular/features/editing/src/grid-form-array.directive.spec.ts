/**
 * Tests for `GridFormArray` directive — exercises the real directive class
 * by mocking Angular's DI primitives. Complements
 * `grid-form-array.directive.spec.ts` (which tests behaviour through a shadow
 * implementation and therefore doesn't lift coverage on the real class).
 *
 * @vitest-environment happy-dom
 */
import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { FormArray, FormControl, FormGroup, type AbstractControl } from '@angular/forms';

// --- Mock Angular DI primitives --------------------------------------------
// Capture the most-recently-installed `inject` resolver so each test can swap
// it. `effect` is stubbed to a no-op (we exercise the post-init behaviour
// directly via event dispatch). `input.required` / `input` return signal-like
// getters whose value can be set per-test through the second argument.
let mockInjectResolver: (token: unknown) => unknown = () => undefined;

vi.mock('@angular/core', async () => {
  const actual = await vi.importActual<typeof import('@angular/core')>('@angular/core');
  function inputFn(initial?: unknown): { (): unknown } & { __setValue: (v: unknown) => void } {
    let value: unknown = initial;
    const fn = (() => value) as { (): unknown } & { __setValue: (v: unknown) => void };
    fn.__setValue = (v: unknown) => {
      value = v;
    };
    return fn;
  }
  const input = Object.assign(inputFn, {
    required: () => inputFn(),
  });
  return {
    ...actual,
    inject: (token: unknown) => mockInjectResolver(token),
    effect: () => ({ destroy: () => undefined }),
    input,
  };
});

vi.mock('@angular/core/rxjs-interop', async () => {
  const actual = await vi.importActual<typeof import('@angular/core/rxjs-interop')>('@angular/core/rxjs-interop');
  return {
    ...actual,
    // Identity: tests destroy subscriptions manually
    takeUntilDestroyed:
      () =>
      <T>(source: T) =>
        source,
  };
});

// Import after mocks
import { DestroyRef, ElementRef } from '@angular/core';
import { GridFormArray, getFormArrayContext } from './grid-form-array.directive';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockGrid extends HTMLElement {
  rows: unknown[];
  on: ReturnType<typeof vi.fn>;
  ready: ReturnType<typeof vi.fn>;
  getRowId: (row: { id?: string }) => string | undefined;
  getPluginByName: ReturnType<typeof vi.fn>;
}

function createMockGrid(initialRows: unknown[] = []): MockGrid {
  const grid = document.createElement('tbw-grid') as unknown as MockGrid;
  grid.rows = initialRows;
  grid.on = vi.fn(() => () => undefined);
  grid.ready = vi.fn(() => Promise.resolve());
  grid.getRowId = (row) => row?.id;
  grid.getPluginByName = vi.fn(() => undefined);
  return grid;
}

interface BuiltDirective {
  directive: GridFormArray;
  grid: MockGrid;
  formArray: FormArray;
  setFormArray: (fa: FormArray) => void;
  setSyncValidation: (v: boolean) => void;
}

function buildDirective(formArray: FormArray, syncValidation = true): BuiltDirective {
  const grid = createMockGrid(formArray.getRawValue());
  const elementRef = { nativeElement: grid as unknown as HTMLElement } as ElementRef<HTMLElement>;
  const destroyRef = { onDestroy: () => () => undefined } as unknown as DestroyRef;

  mockInjectResolver = (token: unknown) => {
    if (token === DestroyRef) return destroyRef;
    if (token === ElementRef) return elementRef;
    return undefined;
  };

  const directive = new GridFormArray();
  // The mocked `input.required` / `input` return a getter bound via `__setValue`
  (directive.formArray as unknown as { __setValue: (v: FormArray) => void }).__setValue(formArray);
  (directive.syncValidation as unknown as { __setValue: (v: boolean) => void }).__setValue(syncValidation);

  return {
    directive,
    grid,
    formArray,
    setFormArray: (fa) => (directive.formArray as unknown as { __setValue: (v: FormArray) => void }).__setValue(fa),
    setSyncValidation: (v) =>
      (directive.syncValidation as unknown as { __setValue: (v: boolean) => void }).__setValue(v),
  };
}

interface CapturedHandlers {
  cellCommit?: (detail: unknown) => void;
  cellCancel?: (detail: unknown) => void;
  rowCommit?: (detail: unknown, event: Event) => void;
}

function captureGridOnHandlers(grid: MockGrid): CapturedHandlers {
  const captured: CapturedHandlers = {};
  grid.on.mockImplementation((eventName: string, handler: (...args: unknown[]) => void) => {
    if (eventName === 'cell-commit') captured.cellCommit = handler as never;
    if (eventName === 'cell-cancel') captured.cellCancel = handler as never;
    if (eventName === 'row-commit') captured.rowCommit = handler as never;
    return () => undefined;
  });
  return captured;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GridFormArray (real directive)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('lifecycle', () => {
    it('ngOnInit registers cell-commit / cell-cancel / row-commit listeners', () => {
      const fa = new FormArray([
        new FormGroup({ name: new FormControl('Alice') }),
        new FormGroup({ name: new FormControl('Bob') }),
      ]);
      const built = buildDirective(fa);
      const captured = captureGridOnHandlers(built.grid);

      built.directive.ngOnInit();

      expect(built.grid.on).toHaveBeenCalledWith('cell-commit', expect.any(Function));
      expect(built.grid.on).toHaveBeenCalledWith('cell-cancel', expect.any(Function));
      expect(built.grid.on).toHaveBeenCalledWith('row-commit', expect.any(Function));
      expect(captured.cellCommit).toBeDefined();
    });

    it('ngOnInit installs a one-shot click listener that marks the FormArray touched', () => {
      const fa = new FormArray([new FormGroup({ name: new FormControl('Alice') })]);
      const built = buildDirective(fa);
      const markTouchedSpy = vi.spyOn(fa, 'markAsTouched');

      built.directive.ngOnInit();
      built.grid.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      // Subsequent click should not re-trigger (one-shot)
      built.grid.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(markTouchedSpy).toHaveBeenCalledTimes(1);
    });

    it('ngOnInit stores a FormArrayContext on the grid element', () => {
      const fa = new FormArray([new FormGroup({ name: new FormControl('A') })]);
      const built = buildDirective(fa);
      built.directive.ngOnInit();
      const ctx = getFormArrayContext(built.grid);
      expect(ctx).toBeDefined();
      expect(ctx?.hasFormGroups).toBe(true);
    });

    it('ngOnDestroy clears the FormArrayContext from the grid element', () => {
      const fa = new FormArray([new FormGroup({ name: new FormControl('A') })]);
      const built = buildDirective(fa);
      built.directive.ngOnInit();
      built.directive.ngOnDestroy();
      expect(getFormArrayContext(built.grid)).toBeUndefined();
    });

    it('ngOnDestroy is safe even when the grid is missing', () => {
      const fa = new FormArray<AbstractControl>([]);
      const built = buildDirective(fa);
      // Replace the elementRef to simulate a missing grid
      (built.directive as unknown as { elementRef: ElementRef<HTMLElement | null> }).elementRef = {
        nativeElement: null,
      } as ElementRef<HTMLElement | null>;
      expect(() => built.directive.ngOnDestroy()).not.toThrow();
    });
  });

  describe('FormArrayContext', () => {
    function setup() {
      const fa = new FormArray([
        new FormGroup({ name: new FormControl('Alice'), age: new FormControl(30) }),
        new FormGroup({ name: new FormControl('Bob'), age: new FormControl(25) }),
      ]);
      const built = buildDirective(fa);
      built.directive.ngOnInit();
      return { ctx: getFormArrayContext(built.grid)!, formArray: fa, built };
    }

    it('getRow returns the value at the given index', () => {
      const { ctx } = setup();
      expect(ctx.getRow(0)).toEqual({ name: 'Alice', age: 30 });
      expect(ctx.getRow(99)).toBeNull();
    });

    it('updateField writes to the matching FormControl and marks it dirty', () => {
      const { ctx, formArray } = setup();
      ctx.updateField(0, 'name', 'Alicia');
      const ctrl = (formArray.at(0) as FormGroup).get('name')!;
      expect(ctrl.value).toBe('Alicia');
      expect(ctrl.dirty).toBe(true);
    });

    it('updateField is a no-op for unknown rows or fields', () => {
      const { ctx } = setup();
      expect(() => ctx.updateField(99, 'name', 'X')).not.toThrow();
      expect(() => ctx.updateField(0, 'unknown', 'X')).not.toThrow();
    });

    it('getValue returns the raw FormArray value', () => {
      const { ctx } = setup();
      expect(ctx.getValue()).toEqual([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ]);
    });

    it('getControl returns the matching FormControl, or undefined', () => {
      const { ctx, formArray } = setup();
      expect(ctx.getControl(0, 'name')).toBe((formArray.at(0) as FormGroup).get('name'));
      expect(ctx.getControl(0, 'unknown')).toBeUndefined();
      expect(ctx.getControl(99, 'name')).toBeUndefined();
    });

    it('getRowFormGroup returns the FormGroup at the row index', () => {
      const { ctx, formArray } = setup();
      expect(ctx.getRowFormGroup(0)).toBe(formArray.at(0));
      expect(ctx.getRowFormGroup(99)).toBeUndefined();
    });

    it('isRowValid returns true for valid rows and unknown indices', () => {
      const { ctx } = setup();
      expect(ctx.isRowValid(0)).toBe(true);
      expect(ctx.isRowValid(99)).toBe(true);
    });

    it('isRowTouched returns false for fresh rows', () => {
      const { ctx, formArray } = setup();
      expect(ctx.isRowTouched(0)).toBe(false);
      (formArray.at(0) as FormGroup).markAsTouched();
      expect(ctx.isRowTouched(0)).toBe(true);
      expect(ctx.isRowTouched(99)).toBe(false);
    });

    it('isRowDirty mirrors FormGroup dirty state', () => {
      const { ctx, formArray } = setup();
      expect(ctx.isRowDirty(0)).toBe(false);
      (formArray.at(0) as FormGroup).markAsDirty();
      expect(ctx.isRowDirty(0)).toBe(true);
      expect(ctx.isRowDirty(99)).toBe(false);
    });

    it('getRowErrors aggregates control errors and group-level errors', () => {
      const fa = new FormArray([
        new FormGroup({
          name: new FormControl('', { nonNullable: true, validators: () => ({ required: true }) }),
        }),
      ]);
      const built = buildDirective(fa);
      built.directive.ngOnInit();
      const ctx = getFormArrayContext(built.grid)!;
      const errors = ctx.getRowErrors(0);
      expect(errors).toEqual({ name: { required: true } });
    });

    it('getRowErrors returns null when there are no errors', () => {
      const { ctx } = setup();
      expect(ctx.getRowErrors(0)).toBeNull();
    });

    it('getRowErrors returns null for unknown rows', () => {
      const { ctx } = setup();
      expect(ctx.getRowErrors(99)).toBeNull();
    });
  });

  describe('cell-commit handling', () => {
    it('updates the FormControl, marks dirty + touched', () => {
      const fa = new FormArray([new FormGroup({ name: new FormControl('Alice') })]);
      const built = buildDirective(fa);
      const captured = captureGridOnHandlers(built.grid);
      built.directive.ngOnInit();

      captured.cellCommit!({ rowIndex: 0, field: 'name', value: 'Alicia', oldValue: 'Alice', rowId: 'r-0' });

      const ctrl = (fa.at(0) as FormGroup).get('name')!;
      expect(ctrl.value).toBe('Alicia');
      expect(ctrl.dirty).toBe(true);
      expect(ctrl.touched).toBe(true);
    });

    it('syncs invalid state to EditingPlugin via setInvalid when the control is invalid', () => {
      const fa = new FormArray([
        new FormGroup({
          name: new FormControl('', { validators: () => ({ required: true }) }),
        }),
      ]);
      const built = buildDirective(fa);
      const setInvalid = vi.fn();
      const clearInvalid = vi.fn();
      built.grid.getPluginByName.mockReturnValue({
        setInvalid,
        clearInvalid,
        clearRowInvalid: vi.fn(),
      });
      const captured = captureGridOnHandlers(built.grid);
      built.directive.ngOnInit();

      captured.cellCommit!({ rowIndex: 0, field: 'name', value: '', oldValue: '', rowId: 'row-1' });

      expect(setInvalid).toHaveBeenCalledWith('row-1', 'name', 'This field is required');
    });

    it('syncs valid state via clearInvalid when the control is valid', () => {
      const fa = new FormArray([new FormGroup({ name: new FormControl('Alice') })]);
      const built = buildDirective(fa);
      const setInvalid = vi.fn();
      const clearInvalid = vi.fn();
      built.grid.getPluginByName.mockReturnValue({ setInvalid, clearInvalid, clearRowInvalid: vi.fn() });
      const captured = captureGridOnHandlers(built.grid);
      built.directive.ngOnInit();

      captured.cellCommit!({ rowIndex: 0, field: 'name', value: 'Alicia', oldValue: 'Alice', rowId: 'row-1' });

      expect(clearInvalid).toHaveBeenCalledWith('row-1', 'name');
    });

    it('skips validation sync when syncValidation is false', () => {
      const fa = new FormArray([
        new FormGroup({
          name: new FormControl('', { validators: () => ({ required: true }) }),
        }),
      ]);
      const built = buildDirective(fa, false);
      const setInvalid = vi.fn();
      built.grid.getPluginByName.mockReturnValue({ setInvalid, clearInvalid: vi.fn(), clearRowInvalid: vi.fn() });
      const captured = captureGridOnHandlers(built.grid);
      built.directive.ngOnInit();

      captured.cellCommit!({ rowIndex: 0, field: 'name', value: '', oldValue: '', rowId: 'row-1' });
      expect(setInvalid).not.toHaveBeenCalled();
    });

    it('is a no-op for unknown rows / fields', () => {
      const fa = new FormArray([new FormGroup({ name: new FormControl('Alice') })]);
      const built = buildDirective(fa);
      const captured = captureGridOnHandlers(built.grid);
      built.directive.ngOnInit();
      expect(() =>
        captured.cellCommit!({ rowIndex: 99, field: 'name', value: 'x', oldValue: 'y', rowId: 'r' }),
      ).not.toThrow();
      expect(() =>
        captured.cellCommit!({ rowIndex: 0, field: 'unknown', value: 'x', oldValue: 'y', rowId: 'r' }),
      ).not.toThrow();
    });
  });

  describe('cell-cancel handling', () => {
    it('reverts the FormControl to the previous value and marks pristine', () => {
      const fa = new FormArray([new FormGroup({ name: new FormControl('Alice') })]);
      const ctrl = (fa.at(0) as FormGroup).get('name')!;
      ctrl.markAsDirty();
      const built = buildDirective(fa);
      const captured = captureGridOnHandlers(built.grid);
      built.directive.ngOnInit();

      captured.cellCancel!({ rowIndex: 0, field: 'name', previousValue: 'Original' });

      expect(ctrl.value).toBe('Original');
      expect(ctrl.pristine).toBe(true);
    });

    it('is a no-op for unknown rows / fields', () => {
      const fa = new FormArray([new FormGroup({ name: new FormControl('Alice') })]);
      const built = buildDirective(fa);
      const captured = captureGridOnHandlers(built.grid);
      built.directive.ngOnInit();
      expect(() => captured.cellCancel!({ rowIndex: 99, field: 'name', previousValue: 'X' })).not.toThrow();
      expect(() => captured.cellCancel!({ rowIndex: 0, field: 'unknown', previousValue: 'X' })).not.toThrow();
    });
  });

  describe('row-commit handling', () => {
    it('preventDefault is called when the FormGroup is invalid', () => {
      const fa = new FormArray([
        new FormGroup({
          name: new FormControl('', { validators: () => ({ required: true }) }),
        }),
      ]);
      const built = buildDirective(fa);
      const captured = captureGridOnHandlers(built.grid);
      built.directive.ngOnInit();

      const event = new CustomEvent('row-commit', { cancelable: true });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      captured.rowCommit!({ rowIndex: 0, rowId: 'r1', changed: true }, event);
      expect(preventSpy).toHaveBeenCalled();
    });

    it('preventDefault is NOT called when the FormGroup is valid', () => {
      const fa = new FormArray([new FormGroup({ name: new FormControl('Alice') })]);
      const built = buildDirective(fa);
      const captured = captureGridOnHandlers(built.grid);
      built.directive.ngOnInit();

      const event = new CustomEvent('row-commit', { cancelable: true });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      captured.rowCommit!({ rowIndex: 0, rowId: 'r1', changed: true }, event);
      expect(preventSpy).not.toHaveBeenCalled();
    });

    it('does nothing when syncValidation is false', () => {
      const fa = new FormArray([
        new FormGroup({
          name: new FormControl('', { validators: () => ({ required: true }) }),
        }),
      ]);
      const built = buildDirective(fa, false);
      const captured = captureGridOnHandlers(built.grid);
      built.directive.ngOnInit();

      const event = new CustomEvent('row-commit', { cancelable: true });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      captured.rowCommit!({ rowIndex: 0, rowId: 'r1', changed: true }, event);
      expect(preventSpy).not.toHaveBeenCalled();
    });
  });

  describe('error message formatting', () => {
    function emit(fa: FormArray) {
      const built = buildDirective(fa);
      const setInvalid = vi.fn();
      built.grid.getPluginByName.mockReturnValue({ setInvalid, clearInvalid: vi.fn(), clearRowInvalid: vi.fn() });
      const captured = captureGridOnHandlers(built.grid);
      built.directive.ngOnInit();
      captured.cellCommit!({ rowIndex: 0, field: 'f', value: '', oldValue: '', rowId: 'r' });
      return setInvalid;
    }

    it.each([
      ['required', { required: true }, 'This field is required'],
      ['minlength', { minlength: { requiredLength: 3 } }, 'Minimum length is 3'],
      ['maxlength', { maxlength: { requiredLength: 10 } }, 'Maximum length is 10'],
      ['min', { min: { min: 1 } }, 'Minimum value is 1'],
      ['max', { max: { max: 99 } }, 'Maximum value is 99'],
      ['email', { email: true }, 'Invalid email address'],
      ['pattern', { pattern: 'abc' }, 'Invalid format'],
    ])('formats %s validator errors', (_name, errors, expected) => {
      const fa = new FormArray([new FormGroup({ f: new FormControl('', { validators: () => errors }) })]);
      const setInvalid = emit(fa);
      expect(setInvalid).toHaveBeenCalledWith('r', 'f', expected);
    });

    it('uses a string error value verbatim', () => {
      const fa = new FormArray([
        new FormGroup({ f: new FormControl('', { validators: () => ({ custom: 'Custom error text' }) }) }),
      ]);
      const setInvalid = emit(fa);
      expect(setInvalid).toHaveBeenCalledWith('r', 'f', 'Custom error text');
    });

    it('uses an object.message error value', () => {
      const fa = new FormArray([
        new FormGroup({
          f: new FormControl('', { validators: () => ({ custom: { message: 'Bad thing' } }) }),
        }),
      ]);
      const setInvalid = emit(fa);
      expect(setInvalid).toHaveBeenCalledWith('r', 'f', 'Bad thing');
    });

    it('falls back to a generic message for unknown error shapes', () => {
      const fa = new FormArray([
        new FormGroup({ f: new FormControl('', { validators: () => ({ custom: { other: 'thing' } }) }) }),
      ]);
      const setInvalid = emit(fa);
      expect(setInvalid).toHaveBeenCalledWith('r', 'f', 'Validation error: custom');
    });
  });

  describe('FormArray of plain FormControls (no FormGroups)', () => {
    it('hasFormGroups is false', () => {
      const fa = new FormArray([new FormControl('A'), new FormControl('B')]);
      const built = buildDirective(fa);
      built.directive.ngOnInit();
      const ctx = getFormArrayContext(built.grid)!;
      expect(ctx.hasFormGroups).toBe(false);
      expect(ctx.getControl(0, 'name')).toBeUndefined();
      expect(ctx.getRowFormGroup(0)).toBeUndefined();
      expect(ctx.isRowValid(0)).toBe(true);
      expect(ctx.isRowTouched(0)).toBe(false);
      expect(ctx.isRowDirty(0)).toBe(false);
      expect(ctx.getRowErrors(0)).toBeNull();
    });

    it('hasFormGroups is false for an empty FormArray', () => {
      const built = buildDirective(new FormArray<AbstractControl>([]));
      built.directive.ngOnInit();
      expect(getFormArrayContext(built.grid)!.hasFormGroups).toBe(false);
    });
  });

  // Touch-up to silence the unused import warning while keeping the import for
  // type completeness.
  void Subject;
});
