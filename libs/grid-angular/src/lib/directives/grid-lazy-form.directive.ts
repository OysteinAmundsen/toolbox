import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import type { BaseGridPlugin, DataGridElement as GridElement } from '@toolbox-web/grid';
import type { FormArrayContext } from './grid-form-array.directive';

/**
 * Interface for EditingPlugin validation methods.
 * We use a minimal interface to avoid importing the full EditingPlugin class.
 */
interface EditingPluginValidation {
  setInvalid(rowId: string, field: string, message?: string): void;
  clearInvalid(rowId: string, field: string): void;
  clearRowInvalid(rowId: string): void;
}

// Symbol for storing form context on the grid element (shared with GridFormArray)
const FORM_ARRAY_CONTEXT = Symbol('formArrayContext');

/**
 * Gets the FormArrayContext from a grid element, if present.
 * @internal
 */
export function getLazyFormContext(gridElement: HTMLElement): FormArrayContext | undefined {
  return (gridElement as unknown as Record<symbol, FormArrayContext>)[FORM_ARRAY_CONTEXT];
}

/**
 * Factory function type for creating FormGroups lazily.
 * Called when a row enters edit mode for the first time.
 *
 * @template TRow The row data type
 * @param row The row data object
 * @param rowIndex The row index in the grid
 * @returns A FormGroup for the row (only include editable fields)
 */
export type LazyFormFactory<TRow = unknown> = (row: TRow, rowIndex: number) => FormGroup;

/**
 * Event emitted when a row's form values have changed.
 */
export interface RowFormChangeEvent<TRow = unknown> {
  /** The row index */
  rowIndex: number;
  /** The row ID (if available) */
  rowId?: string;
  /** The original row data */
  row: TRow;
  /** The FormGroup for this row */
  formGroup: FormGroup;
  /** The current form values */
  values: Partial<TRow>;
  /** Whether the form is valid */
  valid: boolean;
  /** Whether the form is dirty */
  dirty: boolean;
}

/**
 * Directive that provides lazy FormGroup creation for grid editing.
 *
 * Unlike `GridFormArray` which creates all FormGroups upfront, this directive
 * creates FormGroups on-demand only when a row enters edit mode. This provides
 * much better performance for large datasets while still enabling full
 * Angular Reactive Forms integration.
 *
 * ## Key Benefits
 *
 * - **Performance**: Only creates FormGroups for rows being edited (20-100x fewer controls)
 * - **Same DX**: Editors still receive `control` in their context for validation
 * - **Memory efficient**: FormGroups are cleaned up when rows exit edit mode
 *
 * ## Usage
 *
 * ```typescript
 * import { Component, inject, signal } from '@angular/core';
 * import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
 * import { Grid, GridLazyForm, TbwEditor } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   imports: [Grid, GridLazyForm, TbwEditor, ReactiveFormsModule],
 *   template: \`
 *     <tbw-grid
 *       [rows]="employees()"
 *       [lazyForm]="createRowForm"
 *       [angularConfig]="gridConfig">
 *
 *       <tbw-grid-column field="firstName">
 *         <input *tbwEditor="let _; control as ctrl"
 *                [formControl]="ctrl"
 *                [class.is-invalid]="ctrl?.invalid && ctrl?.touched" />
 *       </tbw-grid-column>
 *     </tbw-grid>
 *   \`
 * })
 * export class MyComponent {
 *   private fb = inject(FormBuilder);
 *   employees = signal(generateEmployees(1000));
 *
 *   // Factory called when editing starts - only include editable fields!
 *   createRowForm = (row: Employee): FormGroup => this.fb.group({
 *     firstName: [row.firstName, Validators.required],
 *     lastName: [row.lastName, Validators.minLength(2)],
 *     salary: [row.salary, [Validators.required, Validators.min(0)]],
 *   });
 *
 *   gridConfig = { columns: [...] };
 * }
 * ```
 *
 * ## How It Works
 *
 * 1. Rows come from `[rows]` input (plain data array)
 * 2. When a cell enters edit mode, the FormGroup is created lazily
 * 3. Editors receive the FormControl in their template context
 * 4. On commit, FormGroup values are synced back to the row
 * 5. FormGroup is cleaned up when the row exits edit mode (configurable)
 *
 * ## Performance Comparison
 *
 * | Rows | GridFormArray (20 fields) | GridLazyForm |
 * |------|---------------------------|--------------|
 * | 100  | 2,000 controls           | ~20 controls |
 * | 500  | 10,000 controls          | ~20 controls |
 * | 1000 | 20,000 controls          | ~20 controls |
 *
 * @see GridFormArray For small datasets with full upfront validation
 */
@Directive({
  selector: 'tbw-grid[lazyForm]',
})
export class GridLazyForm<TRow = unknown> implements OnInit, OnDestroy {
  private elementRef = inject(ElementRef<GridElement<TRow>>);

  // Cache of FormGroups by row reference
  private formGroupCache = new Map<TRow, FormGroup>();
  // Map from row reference to rowIndex (needed for getControl)
  private rowIndexMap = new Map<TRow, number>();
  // Track which row is currently being edited
  private editingRowIndex: number | null = null;

  private cellCommitListener: ((e: Event) => void) | null = null;
  private rowCommitListener: ((e: Event) => void) | null = null;
  private rowsChangeListener: ((e: Event) => void) | null = null;

  /**
   * Factory function to create a FormGroup for a row.
   * Called lazily when the row first enters edit mode.
   *
   * @example
   * ```typescript
   * createRowForm = (row: Employee): FormGroup => this.fb.group({
   *   firstName: [row.firstName, Validators.required],
   *   lastName: [row.lastName],
   *   salary: [row.salary, [Validators.min(0)]],
   * });
   * ```
   */
  readonly lazyForm = input.required<LazyFormFactory<TRow>>();

  /**
   * Whether to automatically sync Angular validation state to grid's visual invalid styling.
   *
   * When enabled:
   * - After a cell commit, if the FormControl is invalid, the cell is marked with `setInvalid()`
   * - When a FormControl becomes valid, `clearInvalid()` is called
   * - On `row-commit`, if the row's FormGroup has invalid controls, the commit is prevented
   *
   * @default true
   */
  readonly syncValidation = input<boolean>(true);

  /**
   * Whether to keep FormGroups cached after a row exits edit mode.
   *
   * - `true`: FormGroups are kept, preserving dirty/touched state across edit sessions
   * - `false`: FormGroups are disposed when the row exits edit mode (default)
   *
   * @default false
   */
  readonly keepFormGroups = input<boolean>(false);

  /**
   * Emitted when a row's form values change.
   * Useful for auto-save, validation display, or syncing to external state.
   */
  readonly rowFormChange = output<RowFormChangeEvent<TRow>>();

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    if (!grid) return;

    // Store the form context for AngularGridAdapter to access
    this.#storeFormContext(grid);

    // Listen for cell-commit to update FormControl and sync validation
    this.cellCommitListener = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this.#handleCellCommit(detail);
    };
    grid.addEventListener('cell-commit', this.cellCommitListener);

    // Listen for row-commit to sync FormGroup values back to row and cleanup
    this.rowCommitListener = (e: Event) => {
      const detail = (e as CustomEvent).detail as { rowIndex: number; rowId?: string };
      this.#handleRowCommit(e, detail);
    };
    grid.addEventListener('row-commit', this.rowCommitListener);

    // Listen for rows-change to update row index mappings
    this.rowsChangeListener = () => {
      this.#updateRowIndexMap();
    };
    grid.addEventListener('rows-change', this.rowsChangeListener);

    // Initial row index mapping
    this.#updateRowIndexMap();
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    if (!grid) return;

    if (this.cellCommitListener) {
      grid.removeEventListener('cell-commit', this.cellCommitListener);
    }
    if (this.rowCommitListener) {
      grid.removeEventListener('row-commit', this.rowCommitListener);
    }
    if (this.rowsChangeListener) {
      grid.removeEventListener('rows-change', this.rowsChangeListener);
    }

    this.#clearFormContext(grid);
    this.formGroupCache.clear();
    this.rowIndexMap.clear();
  }

  // #region FormArrayContext Implementation

  /**
   * Gets or creates the FormGroup for a row.
   * This is the core lazy initialization logic.
   */
  #getOrCreateFormGroup(row: TRow, rowIndex: number): FormGroup {
    let formGroup = this.formGroupCache.get(row);
    if (!formGroup) {
      const factory = this.lazyForm();
      formGroup = factory(row, rowIndex);
      this.formGroupCache.set(row, formGroup);
      this.rowIndexMap.set(row, rowIndex);
    }
    return formGroup;
  }

  /**
   * Gets the FormGroup for a row if it exists (without creating).
   */
  #getRowFormGroup(rowIndex: number): FormGroup | undefined {
    const grid = this.elementRef.nativeElement;
    const rows = grid?.rows;
    if (!rows || rowIndex < 0 || rowIndex >= rows.length) return undefined;

    const row = rows[rowIndex];
    return this.formGroupCache.get(row);
  }

  /**
   * Stores the FormArrayContext on the grid element.
   * This uses the same interface as GridFormArray for compatibility.
   */
  #storeFormContext(grid: GridElement<TRow>): void {
    const context: FormArrayContext = {
      getRow: <T>(rowIndex: number): T | null => {
        const rows = grid.rows;
        if (!rows || rowIndex < 0 || rowIndex >= rows.length) return null;
        return rows[rowIndex] as unknown as T;
      },

      updateField: (rowIndex: number, field: string, value: unknown) => {
        const formGroup = this.#getRowFormGroup(rowIndex);
        if (formGroup) {
          const control = formGroup.get(field);
          if (control) {
            control.setValue(value);
            control.markAsDirty();
          }
        }
      },

      getValue: <T>(): T[] => {
        return (grid.rows ?? []) as unknown as T[];
      },

      // Always true for lazy forms - we create FormGroups on demand
      hasFormGroups: true,

      getControl: (rowIndex: number, field: string): AbstractControl | undefined => {
        const rows = grid.rows;
        if (!rows || rowIndex < 0 || rowIndex >= rows.length) return undefined;

        const row = rows[rowIndex] as TRow;
        // LAZY: Create the FormGroup when first needed
        const formGroup = this.#getOrCreateFormGroup(row, rowIndex);
        return formGroup.get(field) ?? undefined;
      },

      getRowFormGroup: (rowIndex: number): FormGroup | undefined => {
        const rows = grid.rows;
        if (!rows || rowIndex < 0 || rowIndex >= rows.length) return undefined;

        const row = rows[rowIndex] as TRow;
        // LAZY: Create the FormGroup when first needed
        return this.#getOrCreateFormGroup(row, rowIndex);
      },

      isRowValid: (rowIndex: number): boolean => {
        const formGroup = this.#getRowFormGroup(rowIndex);
        // If no FormGroup exists yet, consider it valid (not edited)
        if (!formGroup) return true;
        return formGroup.valid;
      },

      isRowTouched: (rowIndex: number): boolean => {
        const formGroup = this.#getRowFormGroup(rowIndex);
        if (!formGroup) return false;
        return formGroup.touched;
      },

      isRowDirty: (rowIndex: number): boolean => {
        const formGroup = this.#getRowFormGroup(rowIndex);
        if (!formGroup) return false;
        return formGroup.dirty;
      },

      getRowErrors: (rowIndex: number): Record<string, unknown> | null => {
        const formGroup = this.#getRowFormGroup(rowIndex);
        if (!formGroup) return null;

        const errors: Record<string, unknown> = {};
        let hasErrors = false;

        Object.keys(formGroup.controls).forEach((field) => {
          const control = formGroup.get(field);
          if (control?.errors) {
            errors[field] = control.errors;
            hasErrors = true;
          }
        });

        if (formGroup.errors) {
          errors['_group'] = formGroup.errors;
          hasErrors = true;
        }

        return hasErrors ? errors : null;
      },
    };

    (grid as unknown as Record<symbol, FormArrayContext>)[FORM_ARRAY_CONTEXT] = context;
  }

  /**
   * Clears the FormArrayContext from the grid element.
   */
  #clearFormContext(grid: GridElement<TRow>): void {
    delete (grid as unknown as Record<symbol, FormArrayContext>)[FORM_ARRAY_CONTEXT];
  }

  // #endregion

  // #region Event Handlers

  /**
   * Updates the row index map when rows change.
   * This ensures we can find FormGroups by row reference after sorting/filtering.
   */
  #updateRowIndexMap(): void {
    const grid = this.elementRef.nativeElement;
    const rows = grid?.rows;
    if (!rows) return;

    this.rowIndexMap.clear();
    rows.forEach((row: TRow, index: number) => {
      if (this.formGroupCache.has(row)) {
        this.rowIndexMap.set(row, index);
      }
    });
  }

  /**
   * Handles cell-commit events by updating the FormControl in the FormGroup.
   */
  #handleCellCommit(detail: { rowIndex: number; field: string; value: unknown; rowId: string }): void {
    const { rowIndex, field, value, rowId } = detail;

    const formGroup = this.#getRowFormGroup(rowIndex);
    if (formGroup) {
      const control = formGroup.get(field);
      if (control) {
        control.setValue(value);
        control.markAsDirty();
        control.markAsTouched();

        // Sync Angular validation state to grid's visual invalid styling
        if (this.syncValidation() && rowId) {
          this.#syncControlValidationToGrid(rowId, field, control);
        }

        // Emit change event
        const grid = this.elementRef.nativeElement;
        const row = grid?.rows?.[rowIndex];
        if (row) {
          this.rowFormChange.emit({
            rowIndex,
            rowId,
            row,
            formGroup,
            values: formGroup.value,
            valid: formGroup.valid,
            dirty: formGroup.dirty,
          });
        }
      }
    }
  }

  /**
   * Handles row-commit events.
   * - Prevents commit if FormGroup is invalid (when syncValidation is true)
   * - Syncs FormGroup values back to the row
   * - Cleans up FormGroup if keepFormGroups is false
   */
  #handleRowCommit(event: Event, detail: { rowIndex: number; rowId?: string }): void {
    const { rowIndex, rowId } = detail;
    const grid = this.elementRef.nativeElement;
    const rows = grid?.rows;
    if (!rows || rowIndex < 0 || rowIndex >= rows.length) return;

    const row = rows[rowIndex];
    const formGroup = this.formGroupCache.get(row);

    if (!formGroup) return;

    // Prevent commit if invalid (when syncValidation is enabled)
    if (this.syncValidation() && formGroup.invalid) {
      // Mark all controls as touched to show validation errors
      formGroup.markAllAsTouched();
      event.preventDefault();
      return;
    }

    // Sync FormGroup values back to the row object
    if (formGroup.dirty) {
      const formValue = formGroup.value;
      Object.keys(formValue).forEach((field) => {
        if (field in row) {
          (row as Record<string, unknown>)[field] = formValue[field];
        }
      });
    }

    // Clean up FormGroup if not keeping them
    if (!this.keepFormGroups()) {
      this.formGroupCache.delete(row);
      this.rowIndexMap.delete(row);

      // Clear any validation state in the grid
      if (rowId) {
        const editingPlugin = (
          grid as unknown as { getPluginByName?: (name: string) => BaseGridPlugin }
        ).getPluginByName?.('editing') as EditingPluginValidation | undefined;
        editingPlugin?.clearRowInvalid(rowId);
      }
    }
  }

  // #endregion

  // #region Validation Sync

  /**
   * Syncs a FormControl's validation state to the grid's visual invalid styling.
   */
  #syncControlValidationToGrid(rowId: string, field: string, control: AbstractControl): void {
    const grid = this.elementRef.nativeElement;
    if (!grid) return;

    const editingPlugin = (grid as unknown as { getPluginByName?: (name: string) => BaseGridPlugin }).getPluginByName?.(
      'editing',
    ) as EditingPluginValidation | undefined;

    if (!editingPlugin) return;

    if (control.invalid) {
      const errorMessage = this.#getFirstErrorMessage(control);
      editingPlugin.setInvalid(rowId, field, errorMessage);
    } else {
      editingPlugin.clearInvalid(rowId, field);
    }
  }

  /**
   * Gets a human-readable error message from the first validation error.
   */
  #getFirstErrorMessage(control: AbstractControl): string {
    const errors = control.errors;
    if (!errors) return '';

    const firstKey = Object.keys(errors)[0];
    const error = errors[firstKey];

    switch (firstKey) {
      case 'required':
        return 'This field is required';
      case 'minlength':
        return `Minimum length is ${error.requiredLength}`;
      case 'maxlength':
        return `Maximum length is ${error.requiredLength}`;
      case 'min':
        return `Minimum value is ${error.min}`;
      case 'max':
        return `Maximum value is ${error.max}`;
      case 'email':
        return 'Invalid email address';
      case 'pattern':
        return 'Invalid format';
      default:
        return typeof error === 'string' ? error : (error?.message ?? `Validation error: ${firstKey}`);
    }
  }

  // #endregion

  // #region Public API

  /**
   * Gets the FormGroup for a row, if it exists.
   * Unlike the context methods, this does NOT create a FormGroup lazily.
   *
   * @param rowIndex The row index
   * @returns The FormGroup or undefined
   */
  getFormGroup(rowIndex: number): FormGroup | undefined {
    return this.#getRowFormGroup(rowIndex);
  }

  /**
   * Gets all cached FormGroups.
   * Useful for bulk validation or inspection.
   *
   * @returns Map of row objects to their FormGroups
   */
  getAllFormGroups(): ReadonlyMap<TRow, FormGroup> {
    return this.formGroupCache;
  }

  /**
   * Clears all cached FormGroups.
   * Useful when the underlying data changes significantly.
   */
  clearAllFormGroups(): void {
    this.formGroupCache.clear();
    this.rowIndexMap.clear();
  }

  /**
   * Validates all currently cached FormGroups.
   *
   * @returns true if all FormGroups are valid, false otherwise
   */
  validateAll(): boolean {
    for (const formGroup of this.formGroupCache.values()) {
      if (formGroup.invalid) {
        formGroup.markAllAsTouched();
        return false;
      }
    }
    return true;
  }

  // #endregion
}
