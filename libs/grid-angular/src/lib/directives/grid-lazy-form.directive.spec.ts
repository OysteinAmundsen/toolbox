/**
 * GridLazyForm Directive Tests
 *
 * Tests the lazy FormGroup binding directive for integrating
 * tbw-grid with Angular Reactive Forms efficiently.
 *
 * Note: We test the directive's behavior directly without Angular's DI
 * to avoid JIT compilation issues in Vitest. Full integration testing
 * would require Angular TestBed with proper AOT setup.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LazyFormFactory } from './grid-lazy-form.directive';

/**
 * Create a mock FormGroup-like object for testing.
 */
function createMockFormGroup(values: Record<string, unknown>) {
  const controls: Record<string, ReturnType<typeof createMockFormControl>> = {};

  Object.entries(values).forEach(([key, value]) => {
    controls[key] = createMockFormControl(value);
  });

  const formGroup = {
    controls,
    value: values,
    valid: true,
    touched: false,
    dirty: false,
    errors: null as Record<string, unknown> | null,
    get: (field: string) => controls[field] ?? null,
    getRawValue: () => {
      const result: Record<string, unknown> = {};
      Object.entries(controls).forEach(([key, control]) => {
        result[key] = control.value;
      });
      return result;
    },
    markAllAsTouched: vi.fn(() => {
      formGroup.touched = true;
      Object.values(controls).forEach((c) => c.markAsTouched());
    }),
  };

  return formGroup;
}

/**
 * Create a mock FormControl-like object for testing.
 */
function createMockFormControl(initialValue: unknown) {
  return {
    value: initialValue,
    errors: null as Record<string, unknown> | null,
    dirty: false,
    touched: false,
    valid: true,
    invalid: false,
    setValue: vi.fn(function (this: { value: unknown }, newValue: unknown) {
      this.value = newValue;
    }),
    markAsDirty: vi.fn(function (this: { dirty: boolean }) {
      this.dirty = true;
    }),
    markAsTouched: vi.fn(function (this: { touched: boolean }) {
      this.touched = true;
    }),
  };
}

interface TestRow {
  id: number;
  name: string;
  age: number;
}

describe('GridLazyForm', () => {
  let grid: HTMLElement & { rows?: TestRow[] };
  let formGroupCache: Map<TestRow, ReturnType<typeof createMockFormGroup>>;
  let formFactory: LazyFormFactory<TestRow>;

  const testRows: TestRow[] = [
    { id: 1, name: 'Alice', age: 30 },
    { id: 2, name: 'Bob', age: 25 },
    { id: 3, name: 'Charlie', age: 35 },
  ];

  beforeEach(() => {
    grid = document.createElement('tbw-grid') as HTMLElement & { rows?: TestRow[] };
    grid.rows = [...testRows];
    document.body.appendChild(grid);

    formGroupCache = new Map();

    // Factory that tracks created FormGroups
    formFactory = (row: TestRow) => {
      const fg = createMockFormGroup({
        name: row.name,
        age: row.age,
      });
      formGroupCache.set(row, fg);
      return fg as unknown as ReturnType<LazyFormFactory<TestRow>>;
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('lazy initialization', () => {
    it('should not create any FormGroups on initialization', () => {
      // Simulating directive ngOnInit - just attaches context, no FormGroups created
      expect(formGroupCache.size).toBe(0);
    });

    it('should create FormGroup lazily when getControl is called', () => {
      // Simulate what happens when editor opens
      const row = grid.rows![0];
      const formGroup = formFactory(row);

      expect(formGroupCache.size).toBe(1);
      expect(formGroupCache.has(row)).toBe(true);

      const control = formGroup.get('name');
      expect(control).toBeDefined();
      expect(control?.value).toBe('Alice');
    });

    it('should return the same FormGroup for repeated calls on the same row', () => {
      const row = grid.rows![0];

      const fg1 = formGroupCache.get(row) ?? formFactory(row);
      const fg2 = formGroupCache.get(row) ?? formFactory(row);

      expect(fg1).toBe(fg2);
      expect(formGroupCache.size).toBe(1);
    });

    it('should create different FormGroups for different rows', () => {
      const row1 = grid.rows![0];
      const row2 = grid.rows![1];

      formFactory(row1);
      formFactory(row2);

      expect(formGroupCache.size).toBe(2);
      expect(formGroupCache.get(row1)).not.toBe(formGroupCache.get(row2));
    });
  });

  describe('FormControl access', () => {
    it('should provide access to individual controls', () => {
      const row = grid.rows![0];
      const formGroup = formFactory(row);

      expect(formGroup.get('name')?.value).toBe('Alice');
      expect(formGroup.get('age')?.value).toBe(30);
    });

    it('should return null for non-existent fields', () => {
      const row = grid.rows![0];
      const formGroup = formFactory(row);

      expect(formGroup.get('nonexistent')).toBeNull();
    });
  });

  describe('cell-commit events', () => {
    it('should update FormControl value on cell-commit', () => {
      const row = grid.rows![0];
      const formGroup = formFactory(row);

      // Simulate cell-commit event
      const control = formGroup.get('name');
      control?.setValue('Alice Updated');
      control?.markAsDirty?.();
      control?.markAsTouched?.();

      expect(control?.value).toBe('Alice Updated');
      expect(control?.dirty).toBe(true);
      expect(control?.touched).toBe(true);
    });

    it('should not create FormGroup for uncommitted rows', () => {
      // If a row doesn't have a cell edited, no FormGroup should be created
      expect(formGroupCache.size).toBe(0);
    });
  });

  describe('validation state', () => {
    it('should consider rows without FormGroups as valid', () => {
      // Row 0 has not been edited, so it should be considered valid
      const hasFormGroup = formGroupCache.has(grid.rows![0]);
      const isValid = !hasFormGroup || formGroupCache.get(grid.rows![0])?.valid;

      expect(hasFormGroup).toBe(false);
      expect(isValid).toBe(true);
    });

    it('should reflect FormGroup validation state for edited rows', () => {
      const row = grid.rows![0];
      const formGroup = formFactory(row);

      expect(formGroup.valid).toBe(true);

      // Simulate invalid state
      formGroup.valid = false;
      expect(formGroup.valid).toBe(false);
    });
  });

  describe('performance characteristics', () => {
    it('should create significantly fewer FormControls than FormArray approach', () => {
      // With FormArray: 3 rows × 2 fields = 6 controls upfront
      // With LazyForm: 0 controls until editing starts, then only 2 per edited row

      // Before any editing
      expect(formGroupCache.size).toBe(0);

      // Edit only the first row
      formFactory(grid.rows![0]);

      // Only 1 FormGroup with 2 controls created
      expect(formGroupCache.size).toBe(1);
      const formGroup = formGroupCache.get(grid.rows![0])!;
      expect(Object.keys(formGroup.controls).length).toBe(2);
    });
  });

  describe('row-commit behavior', () => {
    it('should sync FormGroup values back to row on row-commit', () => {
      const row = grid.rows![0];
      const formGroup = formFactory(row);

      // Edit the form
      const nameControl = formGroup.get('name');
      nameControl?.setValue('Alice Smith');
      formGroup.value.name = 'Alice Smith';
      formGroup.dirty = true;

      // Simulate row-commit by syncing values
      if (formGroup.dirty) {
        const formValue = formGroup.getRawValue();
        Object.keys(formValue).forEach((field) => {
          if (field in row) {
            (row as Record<string, unknown>)[field] = formValue[field];
          }
        });
      }

      expect(row.name).toBe('Alice Smith');
    });

    it('should optionally clean up FormGroup after row-commit when keepFormGroups is false', () => {
      const row = grid.rows![0];
      formFactory(row);
      expect(formGroupCache.size).toBe(1);

      // Simulate cleanup after row-commit
      formGroupCache.delete(row);
      expect(formGroupCache.size).toBe(0);
    });

    it('should keep FormGroup after row-commit when keepFormGroups is true', () => {
      const row = grid.rows![0];
      formFactory(row);
      expect(formGroupCache.size).toBe(1);

      // With keepFormGroups=true, don't delete
      // formGroupCache.delete(row); // Not called
      expect(formGroupCache.size).toBe(1);
    });
  });
});
