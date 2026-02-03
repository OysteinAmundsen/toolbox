import { Directive, effect, ElementRef, inject, input, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import type { BaseGridPlugin, DataGridElement as GridElement } from '@toolbox-web/grid';

/**
 * Interface for EditingPlugin validation methods.
 * We use a minimal interface to avoid importing the full EditingPlugin class.
 */
interface EditingPluginValidation {
  setInvalid(rowId: string, field: string, message?: string): void;
  clearInvalid(rowId: string, field: string): void;
  clearRowInvalid(rowId: string): void;
}

/**
 * Context provided to the grid containing form-related information.
 * This can be accessed by other directives to get form controls.
 */
export interface FormArrayContext {
  /** Get the row data at a specific index */
  getRow<T = unknown>(rowIndex: number): T | null;
  /** Update a field value at a specific row */
  updateField(rowIndex: number, field: string, value: unknown): void;
  /** Get the current form value (all rows) */
  getValue<T = unknown>(): T[];
  /**
   * Get the FormControl for a specific cell.
   * Only available when using FormArray with FormGroup rows.
   *
   * @param rowIndex - The row index
   * @param field - The field name
   * @returns The AbstractControl for the cell, or undefined if not available
   */
  getControl(rowIndex: number, field: string): AbstractControl | undefined;
  /**
   * Whether the grid is backed by a FormArray of FormGroups.
   * When true, `getControl()` will return cell-level controls.
   */
  hasFormGroups: boolean;
  /**
   * Get the FormGroup for a specific row.
   * Only available when using FormArray with FormGroup rows.
   *
   * @param rowIndex - The row index
   * @returns The FormGroup for the row, or undefined if not available
   */
  getRowFormGroup(rowIndex: number): FormGroup | undefined;
  /**
   * Check if a row is valid (all controls in the FormGroup are valid).
   * Returns true if not using FormArray or if the row doesn't exist.
   *
   * @param rowIndex - The row index
   * @returns true if the row is valid, false if any control is invalid
   */
  isRowValid(rowIndex: number): boolean;
  /**
   * Check if a row has been touched (any control in the FormGroup is touched).
   * Returns false if not using FormArray or if the row doesn't exist.
   *
   * @param rowIndex - The row index
   * @returns true if any control in the row is touched
   */
  isRowTouched(rowIndex: number): boolean;
  /**
   * Check if a row is dirty (any control in the FormGroup is dirty).
   * Returns false if not using FormArray or if the row doesn't exist.
   *
   * @param rowIndex - The row index
   * @returns true if any control in the row is dirty
   */
  isRowDirty(rowIndex: number): boolean;
  /**
   * Get validation errors for a specific row.
   * Aggregates errors from all controls in the FormGroup.
   *
   * @param rowIndex - The row index
   * @returns Object with field names as keys and their errors, or null if no errors
   */
  getRowErrors(rowIndex: number): Record<string, unknown> | null;
}

// Symbol for storing form context on the grid element
const FORM_ARRAY_CONTEXT = Symbol('formArrayContext');

/**
 * Gets the FormArrayContext from a grid element, if present.
 * @internal
 */
export function getFormArrayContext(gridElement: HTMLElement): FormArrayContext | undefined {
  return (gridElement as unknown as Record<symbol, FormArrayContext>)[FORM_ARRAY_CONTEXT];
}

/**
 * Directive that binds a FormArray directly to the grid.
 *
 * This is the recommended way to integrate tbw-grid with Angular Reactive Forms.
 * Use a FormArray of FormGroups for row-level validation and cell-level control access.
 *
 * ## Usage
 *
 * ```typescript
 * import { Component, inject } from '@angular/core';
 * import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
 * import { Grid, GridFormArray } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   imports: [Grid, GridFormArray, ReactiveFormsModule],
 *   template: \`
 *     <form [formGroup]="form">
 *       <tbw-grid [formArray]="form.controls.rows" [columns]="columns" />
 *     </form>
 *   \`
 * })
 * export class MyComponent {
 *   private fb = inject(FormBuilder);
 *
 *   form = this.fb.group({
 *     rows: this.fb.array([
 *       this.fb.group({ name: 'Alice', age: 30 }),
 *       this.fb.group({ name: 'Bob', age: 25 }),
 *     ])
 *   });
 *
 *   columns = [
 *     { field: 'name', header: 'Name', editable: true },
 *     { field: 'age', header: 'Age', editable: true }
 *   ];
 * }
 * ```
 *
 * ## How It Works
 *
 * - **FormArray → Grid**: The grid displays the FormArray's value as rows
 * - **Grid → FormArray**: When a cell is edited, the corresponding FormControl is updated
 * - FormArrayContext is available for accessing cell-level controls
 *
 * ## Features
 *
 * - Works naturally with FormArray inside a FormGroup
 * - Provides cell-level FormControl access for validation
 * - Supports row-level validation state aggregation
 * - Automatically syncs FormArray changes to the grid
 */
@Directive({
  selector: 'tbw-grid[formArray]',
})
export class GridFormArray implements OnInit, OnDestroy {
  private elementRef = inject(ElementRef<GridElement>);
  private cellCommitListener: ((e: Event) => void) | null = null;
  private rowCommitListener: ((e: Event) => void) | null = null;
  private touchListener: ((e: Event) => void) | null = null;

  /**
   * The FormArray to bind to the grid.
   */
  readonly formArray = input.required<FormArray>();

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
   * Effect that syncs the FormArray value to the grid rows.
   */
  private syncFormArrayToGrid = effect(() => {
    const formArray = this.formArray();
    const grid = this.elementRef.nativeElement;
    if (grid && formArray) {
      // Get the raw value (including disabled controls)
      grid.rows = formArray.getRawValue();
    }
  });

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    if (!grid) return;

    // Store the form context on the grid element for other directives to access
    this.#storeFormContext(grid);

    // Intercept cell-commit events to update the FormArray
    this.cellCommitListener = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this.#handleCellCommit(detail);
    };
    grid.addEventListener('cell-commit', this.cellCommitListener);

    // Intercept row-commit events to prevent if FormGroup is invalid
    this.rowCommitListener = (e: Event) => {
      if (!this.syncValidation()) return;
      const detail = (e as CustomEvent).detail as { rowIndex: number };
      this.#handleRowCommit(e, detail);
    };
    grid.addEventListener('row-commit', this.rowCommitListener);

    // Mark FormArray as touched on first interaction
    this.touchListener = () => {
      this.formArray().markAsTouched();
      // Remove after first touch
      if (this.touchListener) {
        grid.removeEventListener('click', this.touchListener);
        this.touchListener = null;
      }
    };
    grid.addEventListener('click', this.touchListener);
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
    if (this.touchListener) {
      grid.removeEventListener('click', this.touchListener);
    }

    this.#clearFormContext(grid);
  }

  /**
   * Checks if the FormArray contains FormGroups.
   */
  #isFormArrayOfFormGroups(): boolean {
    const formArray = this.formArray();
    if (formArray.length === 0) return false;
    return formArray.at(0) instanceof FormGroup;
  }

  /**
   * Gets the FormGroup at a specific row index.
   */
  #getRowFormGroup(rowIndex: number): FormGroup | undefined {
    const formArray = this.formArray();
    const rowControl = formArray.at(rowIndex);
    return rowControl instanceof FormGroup ? rowControl : undefined;
  }

  /**
   * Stores the FormArrayContext on the grid element.
   */
  #storeFormContext(grid: GridElement): void {
    const getRowFormGroup = (rowIndex: number) => this.#getRowFormGroup(rowIndex);

    const context: FormArrayContext = {
      getRow: <T>(rowIndex: number): T | null => {
        const formArray = this.formArray();
        const rowControl = formArray.at(rowIndex);
        return rowControl ? (rowControl.value as T) : null;
      },
      updateField: (rowIndex: number, field: string, value: unknown) => {
        const rowFormGroup = getRowFormGroup(rowIndex);
        if (rowFormGroup) {
          const control = rowFormGroup.get(field);
          if (control) {
            control.setValue(value);
            control.markAsDirty();
          }
        }
      },
      getValue: <T>(): T[] => {
        return this.formArray().getRawValue() as T[];
      },
      hasFormGroups: this.#isFormArrayOfFormGroups(),
      getControl: (rowIndex: number, field: string): AbstractControl | undefined => {
        const rowFormGroup = getRowFormGroup(rowIndex);
        if (!rowFormGroup) return undefined;
        return rowFormGroup.get(field) ?? undefined;
      },
      getRowFormGroup,
      isRowValid: (rowIndex: number): boolean => {
        const rowFormGroup = getRowFormGroup(rowIndex);
        if (!rowFormGroup) return true;
        return rowFormGroup.valid;
      },
      isRowTouched: (rowIndex: number): boolean => {
        const rowFormGroup = getRowFormGroup(rowIndex);
        if (!rowFormGroup) return false;
        return rowFormGroup.touched;
      },
      isRowDirty: (rowIndex: number): boolean => {
        const rowFormGroup = getRowFormGroup(rowIndex);
        if (!rowFormGroup) return false;
        return rowFormGroup.dirty;
      },
      getRowErrors: (rowIndex: number): Record<string, unknown> | null => {
        const rowFormGroup = getRowFormGroup(rowIndex);
        if (!rowFormGroup) return null;

        const errors: Record<string, unknown> = {};
        let hasErrors = false;

        Object.keys(rowFormGroup.controls).forEach((field) => {
          const control = rowFormGroup.get(field);
          if (control?.errors) {
            errors[field] = control.errors;
            hasErrors = true;
          }
        });

        if (rowFormGroup.errors) {
          errors['_group'] = rowFormGroup.errors;
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
  #clearFormContext(grid: GridElement): void {
    delete (grid as unknown as Record<symbol, FormArrayContext>)[FORM_ARRAY_CONTEXT];
  }

  /**
   * Handles cell-commit events by updating the FormControl in the FormGroup.
   */
  #handleCellCommit(detail: { rowIndex: number; field: string; value: unknown; rowId: string }): void {
    const { rowIndex, field, value, rowId } = detail;

    const rowFormGroup = this.#getRowFormGroup(rowIndex);
    if (rowFormGroup) {
      const control = rowFormGroup.get(field);
      if (control) {
        control.setValue(value);
        control.markAsDirty();
        control.markAsTouched();

        // Sync Angular validation state to grid's visual invalid styling
        if (this.syncValidation() && rowId) {
          this.#syncControlValidationToGrid(rowId, field, control);
        }
      }
    }
  }

  /**
   * Handles row-commit events - prevents commit if FormGroup has invalid controls.
   */
  #handleRowCommit(event: Event, detail: { rowIndex: number }): void {
    const { rowIndex } = detail;
    const rowFormGroup = this.#getRowFormGroup(rowIndex);

    if (rowFormGroup && rowFormGroup.invalid) {
      // Prevent row commit if the FormGroup is invalid
      event.preventDefault();
    }
  }

  /**
   * Syncs a FormControl's validation state to the grid's visual invalid styling.
   */
  #syncControlValidationToGrid(rowId: string, field: string, control: AbstractControl): void {
    const grid = this.elementRef.nativeElement;
    if (!grid) return;

    // Get EditingPlugin via getPluginByName
    const editingPlugin = (grid as unknown as { getPluginByName?: (name: string) => BaseGridPlugin }).getPluginByName?.(
      'editing',
    ) as EditingPluginValidation | undefined;

    if (!editingPlugin) return;

    if (control.invalid) {
      // Get first error message to display
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

    // Common Angular validators
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
        // Custom validators may provide a message property
        return typeof error === 'string' ? error : (error?.message ?? `Validation error: ${firstKey}`);
    }
  }
}
