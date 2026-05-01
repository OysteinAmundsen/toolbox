/**
 * Tests for `GridLazyForm` directive — exercises the real directive class
 * by mocking Angular's DI primitives. Mirrors the pattern in
 * `grid-form-array.directive.spec.ts`: `inject` is swapped per test,
 * `input.required` / `input` return signal-like getters whose value can be
 * overridden via `__setValue`, `output()` returns a fake EventEmitter that
 * captures emissions.
 *
 * @vitest-environment happy-dom
 */
import '@angular/compiler';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { afterEach, describe, expect, it, vi } from 'vitest';

// --- Mock Angular DI primitives --------------------------------------------
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
  const input = Object.assign(inputFn, { required: () => inputFn() });
  function output(): { emit: ReturnType<typeof vi.fn>; emissions: unknown[] } {
    const emissions: unknown[] = [];
    const emit = vi.fn((value: unknown) => {
      emissions.push(value);
    });
    return { emit, emissions };
  }
  return { ...actual, inject: (token: unknown) => mockInjectResolver(token), input, output };
});

// Import after mocks
import { ElementRef } from '@angular/core';
import type { FormArrayContext } from './grid-form-array.directive';
import { getLazyFormContext, GridLazyForm, type LazyFormFactory } from './grid-lazy-form.directive';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Employee {
  id: string;
  name: string;
  salary: number;
}

interface MockGrid extends HTMLElement {
  rows: Employee[];
  on: ReturnType<typeof vi.fn>;
  getPluginByName: ReturnType<typeof vi.fn>;
}

function createMockGrid(rows: Employee[] = []): MockGrid {
  const grid = document.createElement('tbw-grid') as unknown as MockGrid;
  grid.rows = rows;
  grid.on = vi.fn(() => () => undefined);
  grid.getPluginByName = vi.fn(() => undefined);
  return grid;
}

interface BuiltDirective {
  directive: GridLazyForm<Employee>;
  grid: MockGrid;
  factory: LazyFormFactory<Employee>;
  setLazyForm: (f: LazyFormFactory<Employee>) => void;
  setSyncValidation: (v: boolean) => void;
  setKeepFormGroups: (v: boolean) => void;
  rowFormChangeEmissions: () => unknown[];
}

function buildDirective(
  rows: Employee[] = [],
  factory: LazyFormFactory<Employee> = (row) =>
    new FormGroup({
      name: new FormControl(row.name, Validators.required),
      salary: new FormControl(row.salary, [Validators.required, Validators.min(0)]),
    }),
  syncValidation = true,
  keepFormGroups = false,
): BuiltDirective {
  const grid = createMockGrid(rows);
  const elementRef = { nativeElement: grid as unknown as HTMLElement } as ElementRef<HTMLElement>;

  mockInjectResolver = (token: unknown) => (token === ElementRef ? elementRef : undefined);

  const directive = new GridLazyForm<Employee>();
  const setSig = (sig: unknown, v: unknown) => (sig as { __setValue: (x: unknown) => void }).__setValue(v);
  setSig(directive.lazyForm, factory);
  setSig(directive.syncValidation, syncValidation);
  setSig(directive.keepFormGroups, keepFormGroups);

  return {
    directive,
    grid,
    factory,
    setLazyForm: (f) => setSig(directive.lazyForm, f),
    setSyncValidation: (v) => setSig(directive.syncValidation, v),
    setKeepFormGroups: (v) => setSig(directive.keepFormGroups, v),
    rowFormChangeEmissions: () => (directive.rowFormChange as unknown as { emissions: unknown[] }).emissions,
  };
}

interface CapturedHandlers {
  cellCommit?: (detail: unknown) => void;
  rowCommit?: (detail: unknown, event: CustomEvent) => void;
  rowsChange?: () => void;
}

function captureGridOnHandlers(grid: MockGrid): CapturedHandlers {
  const captured: CapturedHandlers = {};
  grid.on.mockImplementation((eventName: string, handler: (...args: unknown[]) => void) => {
    if (eventName === 'cell-commit') captured.cellCommit = handler as never;
    if (eventName === 'row-commit') captured.rowCommit = handler as never;
    if (eventName === 'rows-change') captured.rowsChange = handler as never;
    return () => undefined;
  });
  return captured;
}

afterEach(() => {
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GridLazyForm: lifecycle', () => {
  it('ngOnInit registers cell-commit / row-commit / rows-change listeners', () => {
    const built = buildDirective([{ id: '1', name: 'Alice', salary: 100 }]);
    const captured = captureGridOnHandlers(built.grid);

    built.directive.ngOnInit();

    expect(built.grid.on).toHaveBeenCalledWith('cell-commit', expect.any(Function));
    expect(built.grid.on).toHaveBeenCalledWith('row-commit', expect.any(Function));
    expect(built.grid.on).toHaveBeenCalledWith('rows-change', expect.any(Function));
    expect(captured.cellCommit).toBeDefined();
    expect(captured.rowCommit).toBeDefined();
    expect(captured.rowsChange).toBeDefined();
  });

  it('ngOnInit stores a FormArrayContext on the grid element', () => {
    const built = buildDirective([{ id: '1', name: 'Alice', salary: 100 }]);
    built.directive.ngOnInit();

    const ctx = getLazyFormContext(built.grid);
    expect(ctx).toBeDefined();
    expect(ctx?.hasFormGroups).toBe(true);
  });

  it('ngOnInit is a no-op when the grid element is missing', () => {
    const built = buildDirective();
    (built.directive as unknown as { elementRef: ElementRef<HTMLElement | null> }).elementRef = {
      nativeElement: null,
    } as ElementRef<HTMLElement | null>;
    expect(() => built.directive.ngOnInit()).not.toThrow();
  });

  it('ngOnDestroy clears the FormArrayContext and unsubscribes', () => {
    const unsub = vi.fn();
    const built = buildDirective([{ id: '1', name: 'Alice', salary: 100 }]);
    built.grid.on.mockImplementation(() => unsub);

    built.directive.ngOnInit();
    built.directive.ngOnDestroy();

    expect(getLazyFormContext(built.grid)).toBeUndefined();
    // 3 listeners (cell-commit, row-commit, rows-change) → 3 unsubscribes
    expect(unsub).toHaveBeenCalledTimes(3);
  });

  it('ngOnDestroy is safe when the grid is missing', () => {
    const built = buildDirective();
    (built.directive as unknown as { elementRef: ElementRef<HTMLElement | null> }).elementRef = {
      nativeElement: null,
    } as ElementRef<HTMLElement | null>;
    expect(() => built.directive.ngOnDestroy()).not.toThrow();
  });
});

describe('GridLazyForm: FormArrayContext', () => {
  function setup(rows: Employee[] = [{ id: '1', name: 'Alice', salary: 100 }]) {
    const built = buildDirective(rows);
    built.directive.ngOnInit();
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    return { ...built, ctx };
  }

  it('getRow returns the row at the given index', () => {
    const { ctx } = setup([
      { id: '1', name: 'Alice', salary: 100 },
      { id: '2', name: 'Bob', salary: 200 },
    ]);
    expect(ctx.getRow<Employee>(1)).toEqual({ id: '2', name: 'Bob', salary: 200 });
  });

  it('getRow returns null for out-of-bounds indices', () => {
    const { ctx } = setup();
    expect(ctx.getRow<Employee>(-1)).toBeNull();
    expect(ctx.getRow<Employee>(99)).toBeNull();
  });

  it('getValue returns the full rows array', () => {
    const rows: Employee[] = [
      { id: '1', name: 'Alice', salary: 100 },
      { id: '2', name: 'Bob', salary: 200 },
    ];
    const { ctx } = setup(rows);
    expect(ctx.getValue<Employee>()).toEqual(rows);
  });

  it('getControl creates a FormGroup lazily on first access', () => {
    const { ctx, factory } = setup();
    const factorySpy = vi.fn(factory);
    // re-bind the spied factory on the directive
    const fresh = buildDirective([{ id: '1', name: 'Alice', salary: 100 }], factorySpy);
    fresh.directive.ngOnInit();
    const freshCtx = getLazyFormContext(fresh.grid) as FormArrayContext;

    expect(factorySpy).not.toHaveBeenCalled();
    const control = freshCtx.getControl?.(0, 'name');
    expect(factorySpy).toHaveBeenCalledTimes(1);
    expect(control?.value).toBe('Alice');

    // Second call reuses the cached FormGroup
    freshCtx.getControl?.(0, 'salary');
    expect(factorySpy).toHaveBeenCalledTimes(1);

    // `ctx` from outer setup is unrelated; just exercise it once for branch coverage
    expect(ctx.getControl?.(0, 'name')?.value).toBe('Alice');
  });

  it('getControl returns undefined for out-of-bounds indices', () => {
    const { ctx } = setup();
    expect(ctx.getControl?.(-1, 'name')).toBeUndefined();
    expect(ctx.getControl?.(99, 'name')).toBeUndefined();
  });

  it('getControl returns undefined when the field does not exist on the FormGroup', () => {
    const { ctx } = setup();
    expect(ctx.getControl?.(0, 'doesNotExist')).toBeUndefined();
  });

  it('getRowFormGroup creates a FormGroup lazily', () => {
    const { ctx } = setup();
    const fg = ctx.getRowFormGroup?.(0);
    expect(fg).toBeDefined();
    expect(fg?.get('name')?.value).toBe('Alice');
  });

  it('getRowFormGroup returns undefined for out-of-bounds indices', () => {
    const { ctx } = setup();
    expect(ctx.getRowFormGroup?.(-1)).toBeUndefined();
    expect(ctx.getRowFormGroup?.(99)).toBeUndefined();
  });

  it('updateField sets the FormControl value and marks it dirty', () => {
    const { ctx } = setup();
    // Materialise the FormGroup first
    ctx.getControl?.(0, 'name');
    ctx.updateField(0, 'name', 'Alice Updated');
    const ctrl = ctx.getControl?.(0, 'name');
    expect(ctrl?.value).toBe('Alice Updated');
    expect(ctrl?.dirty).toBe(true);
  });

  it('updateField is a no-op when no FormGroup exists for the row', () => {
    const { ctx } = setup();
    // No materialisation → updateField cannot find a FormGroup
    expect(() => ctx.updateField(0, 'name', 'X')).not.toThrow();
  });

  it('updateField is a no-op when the field does not exist', () => {
    const { ctx } = setup();
    ctx.getControl?.(0, 'name');
    expect(() => ctx.updateField(0, 'doesNotExist', 'X')).not.toThrow();
  });

  it('isRowValid returns true when no FormGroup has been materialised', () => {
    const { ctx } = setup();
    expect(ctx.isRowValid?.(0)).toBe(true);
  });

  it('isRowValid reflects FormGroup validity once materialised', () => {
    const { ctx } = setup([{ id: '1', name: '', salary: -5 }]);
    ctx.getRowFormGroup?.(0); // materialise
    expect(ctx.isRowValid?.(0)).toBe(false);
  });

  it('isRowTouched returns false when no FormGroup exists', () => {
    const { ctx } = setup();
    expect(ctx.isRowTouched?.(0)).toBe(false);
  });

  it('isRowTouched reflects FormGroup touched state', () => {
    const { ctx } = setup();
    const fg = ctx.getRowFormGroup?.(0);
    fg?.markAllAsTouched();
    expect(ctx.isRowTouched?.(0)).toBe(true);
  });

  it('isRowDirty returns false when no FormGroup exists', () => {
    const { ctx } = setup();
    expect(ctx.isRowDirty?.(0)).toBe(false);
  });

  it('isRowDirty reflects FormGroup dirty state', () => {
    const { ctx } = setup();
    const fg = ctx.getRowFormGroup?.(0);
    fg?.get('name')?.markAsDirty();
    expect(ctx.isRowDirty?.(0)).toBe(true);
  });

  it('getRowErrors returns null when no FormGroup exists', () => {
    const { ctx } = setup();
    expect(ctx.getRowErrors?.(0)).toBeNull();
  });

  it('getRowErrors returns null when the FormGroup is valid', () => {
    const { ctx } = setup();
    ctx.getRowFormGroup?.(0);
    expect(ctx.getRowErrors?.(0)).toBeNull();
  });

  it('getRowErrors returns per-control errors when controls are invalid', () => {
    const { ctx } = setup([{ id: '1', name: '', salary: -5 }]);
    ctx.getRowFormGroup?.(0);
    const errors = ctx.getRowErrors?.(0);
    expect(errors).not.toBeNull();
    expect(errors?.['name']).toBeDefined();
    expect(errors?.['salary']).toBeDefined();
  });

  it('getRowErrors includes group-level errors under `_group`', () => {
    const groupValidator = () => ({ groupError: true });
    const factory: LazyFormFactory<Employee> = (row) => {
      const fg = new FormGroup(
        {
          name: new FormControl(row.name),
          salary: new FormControl(row.salary),
        },
        { validators: [groupValidator] },
      );
      return fg;
    };
    const built = buildDirective([{ id: '1', name: 'Alice', salary: 100 }], factory);
    built.directive.ngOnInit();
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);

    const errors = ctx.getRowErrors?.(0);
    expect(errors?.['_group']).toEqual({ groupError: true });
  });
});

describe('GridLazyForm: cell-commit handler', () => {
  function setup(rows: Employee[] = [{ id: '1', name: 'Alice', salary: 100 }], syncValidation = true) {
    const built = buildDirective(rows, undefined, syncValidation);
    const captured = captureGridOnHandlers(built.grid);
    built.directive.ngOnInit();
    return { ...built, captured };
  }

  it('updates the FormControl value and marks it dirty + touched', () => {
    const { captured, directive } = setup();
    // Materialise a FormGroup first via getControl
    const ctx = getLazyFormContext(directive['elementRef'].nativeElement) as FormArrayContext;
    ctx.getRowFormGroup?.(0);

    captured.cellCommit?.({ rowIndex: 0, field: 'name', value: 'Alice Updated', oldValue: 'Alice', rowId: '1' });

    const ctrl = ctx.getControl?.(0, 'name');
    expect(ctrl?.value).toBe('Alice Updated');
    expect(ctrl?.dirty).toBe(true);
    expect(ctrl?.touched).toBe(true);
  });

  it('emits rowFormChange after updating the control', () => {
    const built = setup();
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);

    built.captured.cellCommit?.({ rowIndex: 0, field: 'name', value: 'Bob', oldValue: 'Alice', rowId: '1' });

    const emissions = built.rowFormChangeEmissions();
    expect(emissions).toHaveLength(1);
    const event = emissions[0] as { rowIndex: number; rowId?: string; values: Partial<Employee> };
    expect(event.rowIndex).toBe(0);
    expect(event.rowId).toBe('1');
    expect(event.values.name).toBe('Bob');
  });

  it('is a no-op when no FormGroup exists for the row', () => {
    const built = setup();
    // Do NOT materialise — handler should silently bail
    built.captured.cellCommit?.({ rowIndex: 0, field: 'name', value: 'X', oldValue: 'Alice', rowId: '1' });
    expect(built.rowFormChangeEmissions()).toHaveLength(0);
  });

  it('is a no-op when the field does not exist on the FormGroup', () => {
    const built = setup();
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);
    built.captured.cellCommit?.({ rowIndex: 0, field: 'doesNotExist', value: 'X', oldValue: 'Y', rowId: '1' });
    expect(built.rowFormChangeEmissions()).toHaveLength(0);
  });

  it('calls editingPlugin.setInvalid when the control is invalid and syncValidation is true', () => {
    const built = setup([{ id: '1', name: 'Alice', salary: 100 }], true);
    const setInvalid = vi.fn();
    const clearInvalid = vi.fn();
    built.grid.getPluginByName.mockImplementation((name: string) =>
      name === 'editing' ? { setInvalid, clearInvalid, clearRowInvalid: vi.fn() } : undefined,
    );
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);

    built.captured.cellCommit?.({ rowIndex: 0, field: 'name', value: '', oldValue: 'Alice', rowId: '1' });

    expect(setInvalid).toHaveBeenCalledWith('1', 'name', 'This field is required');
    expect(clearInvalid).not.toHaveBeenCalled();
  });

  it('calls editingPlugin.clearInvalid when the control becomes valid', () => {
    const built = setup([{ id: '1', name: 'Alice', salary: 100 }], true);
    const setInvalid = vi.fn();
    const clearInvalid = vi.fn();
    built.grid.getPluginByName.mockImplementation((name: string) =>
      name === 'editing' ? { setInvalid, clearInvalid, clearRowInvalid: vi.fn() } : undefined,
    );
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);

    built.captured.cellCommit?.({ rowIndex: 0, field: 'name', value: 'Bob', oldValue: 'Alice', rowId: '1' });

    expect(clearInvalid).toHaveBeenCalledWith('1', 'name');
    expect(setInvalid).not.toHaveBeenCalled();
  });

  it('does not touch the editing plugin when syncValidation is false', () => {
    const built = setup([{ id: '1', name: 'Alice', salary: 100 }], false);
    const setInvalid = vi.fn();
    built.grid.getPluginByName.mockImplementation(() => ({
      setInvalid,
      clearInvalid: vi.fn(),
      clearRowInvalid: vi.fn(),
    }));
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);

    built.captured.cellCommit?.({ rowIndex: 0, field: 'name', value: '', oldValue: 'Alice', rowId: '1' });

    expect(setInvalid).not.toHaveBeenCalled();
  });

  it('does not touch the editing plugin when rowId is empty', () => {
    const built = setup([{ id: '', name: 'Alice', salary: 100 }], true);
    const setInvalid = vi.fn();
    built.grid.getPluginByName.mockImplementation(() => ({
      setInvalid,
      clearInvalid: vi.fn(),
      clearRowInvalid: vi.fn(),
    }));
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);

    built.captured.cellCommit?.({ rowIndex: 0, field: 'name', value: '', oldValue: 'Alice', rowId: '' });

    expect(setInvalid).not.toHaveBeenCalled();
  });

  it('handles missing editing plugin gracefully', () => {
    const built = setup([{ id: '1', name: 'Alice', salary: 100 }], true);
    built.grid.getPluginByName.mockReturnValue(undefined);
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);

    expect(() =>
      built.captured.cellCommit?.({ rowIndex: 0, field: 'name', value: '', oldValue: 'Alice', rowId: '1' }),
    ).not.toThrow();
  });
});

describe('GridLazyForm: row-commit handler', () => {
  function setup(
    rows: Employee[] = [{ id: '1', name: 'Alice', salary: 100 }],
    opts: { syncValidation?: boolean; keepFormGroups?: boolean } = {},
  ) {
    const built = buildDirective(rows, undefined, opts.syncValidation ?? true, opts.keepFormGroups ?? false);
    const captured = captureGridOnHandlers(built.grid);
    built.directive.ngOnInit();
    return { ...built, captured };
  }

  function makeEvent() {
    return new CustomEvent('row-commit', { cancelable: true });
  }

  it('is a no-op for out-of-bounds indices', () => {
    const built = setup();
    expect(() => built.captured.rowCommit?.({ rowIndex: 99, rowId: '1' }, makeEvent())).not.toThrow();
    expect(() => built.captured.rowCommit?.({ rowIndex: -1, rowId: '1' }, makeEvent())).not.toThrow();
  });

  it('is a no-op when no FormGroup exists for the row', () => {
    const built = setup();
    const event = makeEvent();
    built.captured.rowCommit?.({ rowIndex: 0, rowId: '1' }, event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('calls preventDefault and marks all as touched when syncValidation is on and FormGroup is invalid', () => {
    const built = setup([{ id: '1', name: '', salary: -5 }], { syncValidation: true });
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    const fg = ctx.getRowFormGroup?.(0);
    expect(fg?.invalid).toBe(true);
    const event = makeEvent();

    built.captured.rowCommit?.({ rowIndex: 0, rowId: '1' }, event);

    expect(event.defaultPrevented).toBe(true);
    expect(fg?.get('name')?.touched).toBe(true);
  });

  it('does NOT preventDefault when syncValidation is off, even for invalid FormGroups', () => {
    const built = setup([{ id: '1', name: '', salary: -5 }], { syncValidation: false });
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);
    const event = makeEvent();

    built.captured.rowCommit?.({ rowIndex: 0, rowId: '1' }, event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('syncs dirty FormGroup values back to the row object', () => {
    const built = setup();
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    const fg = ctx.getRowFormGroup?.(0);
    fg?.get('name')?.setValue('Updated');
    fg?.get('name')?.markAsDirty();
    const event = makeEvent();

    built.captured.rowCommit?.({ rowIndex: 0, rowId: '1' }, event);

    expect(built.grid.rows[0].name).toBe('Updated');
  });

  it('does not sync values when the FormGroup is not dirty', () => {
    const built = setup();
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0); // materialise but do not modify
    const event = makeEvent();

    built.captured.rowCommit?.({ rowIndex: 0, rowId: '1' }, event);

    expect(built.grid.rows[0].name).toBe('Alice');
  });

  it('cleans up the cached FormGroup when keepFormGroups is false (default)', () => {
    const built = setup();
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);
    expect(built.directive.getAllFormGroups().size).toBe(1);

    built.captured.rowCommit?.({ rowIndex: 0, rowId: '1' }, makeEvent());

    expect(built.directive.getAllFormGroups().size).toBe(0);
  });

  it('keeps the cached FormGroup when keepFormGroups is true', () => {
    const built = setup([{ id: '1', name: 'Alice', salary: 100 }], { keepFormGroups: true });
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);

    built.captured.rowCommit?.({ rowIndex: 0, rowId: '1' }, makeEvent());

    expect(built.directive.getAllFormGroups().size).toBe(1);
  });

  it('calls editingPlugin.clearRowInvalid on cleanup when rowId is present', () => {
    const built = setup();
    const clearRowInvalid = vi.fn();
    built.grid.getPluginByName.mockReturnValue({ setInvalid: vi.fn(), clearInvalid: vi.fn(), clearRowInvalid });
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);

    built.captured.rowCommit?.({ rowIndex: 0, rowId: '1' }, makeEvent());

    expect(clearRowInvalid).toHaveBeenCalledWith('1');
  });

  it('does not call clearRowInvalid when rowId is missing', () => {
    const built = setup();
    const clearRowInvalid = vi.fn();
    built.grid.getPluginByName.mockReturnValue({ setInvalid: vi.fn(), clearInvalid: vi.fn(), clearRowInvalid });
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);

    built.captured.rowCommit?.({ rowIndex: 0 }, makeEvent());

    expect(clearRowInvalid).not.toHaveBeenCalled();
  });
});

describe('GridLazyForm: rows-change handler', () => {
  it('updates row index map for cached rows after rows-change fires', () => {
    const r1 = { id: '1', name: 'Alice', salary: 100 };
    const r2 = { id: '2', name: 'Bob', salary: 200 };
    const built = buildDirective([r1, r2]);
    const captured = captureGridOnHandlers(built.grid);
    built.directive.ngOnInit();

    // Materialise FormGroup for r2 (index 1)
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(1);

    // Reorder the rows
    built.grid.rows = [r2, r1];
    captured.rowsChange?.();

    // Now r2 lives at index 0 and its cached FormGroup should still be reachable
    expect(built.directive.getFormGroup(0)).toBeDefined();
    expect(built.directive.getFormGroup(0)?.get('name')?.value).toBe('Bob');
  });

  it('handles missing rows gracefully', () => {
    const built = buildDirective();
    const captured = captureGridOnHandlers(built.grid);
    built.directive.ngOnInit();
    (built.grid as unknown as { rows: undefined }).rows = undefined;

    expect(() => captured.rowsChange?.()).not.toThrow();
  });
});

describe('GridLazyForm: error message extraction', () => {
  function commitWithErrors(factory: LazyFormFactory<Employee>, field: string, value: unknown): string | undefined {
    const built = buildDirective([{ id: '1', name: 'Alice', salary: 100 }], factory);
    const captured = captureGridOnHandlers(built.grid);
    built.directive.ngOnInit();
    let recordedMessage: string | undefined;
    built.grid.getPluginByName.mockReturnValue({
      setInvalid: (_id: string, _f: string, msg?: string) => {
        recordedMessage = msg;
      },
      clearInvalid: vi.fn(),
      clearRowInvalid: vi.fn(),
    });
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);
    captured.cellCommit?.({ rowIndex: 0, field, value, oldValue: 'x', rowId: '1' });
    return recordedMessage;
  }

  it('formats `required` errors', () => {
    expect(commitWithErrors(() => new FormGroup({ name: new FormControl('', Validators.required) }), 'name', '')).toBe(
      'This field is required',
    );
  });

  it('formats `minlength` errors', () => {
    expect(
      commitWithErrors(() => new FormGroup({ name: new FormControl('a', Validators.minLength(3)) }), 'name', 'a'),
    ).toBe('Minimum length is 3');
  });

  it('formats `maxlength` errors', () => {
    expect(
      commitWithErrors(() => new FormGroup({ name: new FormControl('abcd', Validators.maxLength(3)) }), 'name', 'abcd'),
    ).toBe('Maximum length is 3');
  });

  it('formats `min` errors', () => {
    expect(
      commitWithErrors(() => new FormGroup({ salary: new FormControl(-1, Validators.min(0)) }), 'salary', -1),
    ).toBe('Minimum value is 0');
  });

  it('formats `max` errors', () => {
    expect(
      commitWithErrors(() => new FormGroup({ salary: new FormControl(101, Validators.max(100)) }), 'salary', 101),
    ).toBe('Maximum value is 100');
  });

  it('formats `email` errors', () => {
    expect(
      commitWithErrors(
        () => new FormGroup({ name: new FormControl('not-an-email', Validators.email) }),
        'name',
        'not-an-email',
      ),
    ).toBe('Invalid email address');
  });

  it('formats `pattern` errors', () => {
    expect(
      commitWithErrors(
        () => new FormGroup({ name: new FormControl('abc', Validators.pattern(/^\d+$/)) }),
        'name',
        'abc',
      ),
    ).toBe('Invalid format');
  });

  it('formats string-typed custom errors', () => {
    const stringValidator = () => ({ custom: 'A string error' });
    expect(commitWithErrors(() => new FormGroup({ name: new FormControl('a', stringValidator) }), 'name', 'a')).toBe(
      'A string error',
    );
  });

  it('formats object-typed custom errors with a message field', () => {
    const objValidator = () => ({ custom: { message: 'object error message' } });
    expect(commitWithErrors(() => new FormGroup({ name: new FormControl('a', objValidator) }), 'name', 'a')).toBe(
      'object error message',
    );
  });

  it('falls back to a generic message when no string and no message field', () => {
    const noopMessage = () => ({ custom: { someKey: 1 } });
    expect(commitWithErrors(() => new FormGroup({ name: new FormControl('a', noopMessage) }), 'name', 'a')).toBe(
      'Validation error: custom',
    );
  });
});

describe('GridLazyForm: public API', () => {
  it('getFormGroup returns undefined for non-cached rows', () => {
    const built = buildDirective([{ id: '1', name: 'Alice', salary: 100 }]);
    built.directive.ngOnInit();
    expect(built.directive.getFormGroup(0)).toBeUndefined();
  });

  it('getFormGroup returns the cached FormGroup once materialised', () => {
    const built = buildDirective([{ id: '1', name: 'Alice', salary: 100 }]);
    built.directive.ngOnInit();
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);
    expect(built.directive.getFormGroup(0)).toBeDefined();
  });

  it('getAllFormGroups exposes the cache as a read-only Map', () => {
    const built = buildDirective([
      { id: '1', name: 'A', salary: 1 },
      { id: '2', name: 'B', salary: 2 },
    ]);
    built.directive.ngOnInit();
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);
    ctx.getRowFormGroup?.(1);
    expect(built.directive.getAllFormGroups().size).toBe(2);
  });

  it('clearAllFormGroups empties the cache', () => {
    const built = buildDirective([{ id: '1', name: 'A', salary: 1 }]);
    built.directive.ngOnInit();
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);
    expect(built.directive.getAllFormGroups().size).toBe(1);
    built.directive.clearAllFormGroups();
    expect(built.directive.getAllFormGroups().size).toBe(0);
  });

  it('validateAll returns true when no FormGroups are cached', () => {
    const built = buildDirective();
    built.directive.ngOnInit();
    expect(built.directive.validateAll()).toBe(true);
  });

  it('validateAll returns true when all cached FormGroups are valid', () => {
    const built = buildDirective([{ id: '1', name: 'Alice', salary: 100 }]);
    built.directive.ngOnInit();
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    ctx.getRowFormGroup?.(0);
    expect(built.directive.validateAll()).toBe(true);
  });

  it('validateAll returns false and marks invalid groups touched when any is invalid', () => {
    const built = buildDirective([{ id: '1', name: '', salary: -1 }]);
    built.directive.ngOnInit();
    const ctx = getLazyFormContext(built.grid) as FormArrayContext;
    const fg = ctx.getRowFormGroup?.(0);
    expect(built.directive.validateAll()).toBe(false);
    expect(fg?.get('name')?.touched).toBe(true);
  });
});

describe('getLazyFormContext', () => {
  it('returns undefined when no context is stored', () => {
    const grid = document.createElement('tbw-grid');
    expect(getLazyFormContext(grid)).toBeUndefined();
  });
});
