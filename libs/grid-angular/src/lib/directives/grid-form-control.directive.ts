import { Directive, effect, ElementRef, forwardRef, inject, Injector, input, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormArray,
  FormControl,
  FormGroup,
  NG_VALUE_ACCESSOR,
  NgControl,
} from '@angular/forms';
import type { DataGridElement as GridElement } from '@toolbox-web/grid';

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
 * Directive that makes tbw-grid a proper Angular form control.
 *
 * This implements `ControlValueAccessor` to integrate seamlessly with Angular Reactive Forms.
 * The grid's row data becomes the form control's value - an array of row objects.
 *
 * ## Usage with formControlName (inside a FormGroup)
 *
 * ```typescript
 * import { Component } from '@angular/core';
 * import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
 * import { Grid, GridFormControl } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   imports: [Grid, GridFormControl, ReactiveFormsModule],
 *   template: \`
 *     <form [formGroup]="form">
 *       <tbw-grid formControlName="employees" [columns]="columns" />
 *     </form>
 *   \`
 * })
 * export class MyComponent {
 *   form = new FormGroup({
 *     employees: new FormControl([
 *       { name: 'Alice', age: 30 },
 *       { name: 'Bob', age: 25 },
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
 * ## Usage with standalone formControl
 *
 * ```typescript
 * @Component({
 *   template: \`<tbw-grid [formControl]="employeesControl" [columns]="columns" />\`
 * })
 * export class MyComponent {
 *   employeesControl = new FormControl([
 *     { name: 'Alice', age: 30 },
 *     { name: 'Bob', age: 25 },
 *   ]);
 * }
 * ```
 *
 * ## How It Works
 *
 * - **Form → Grid**: When the form value changes, the grid rows are updated
 * - **Grid → Form**: When a cell is edited, the form value is updated
 * - The grid becomes "touched" when the user interacts with it
 * - The grid becomes "dirty" when any cell is edited
 *
 * ## Validation
 *
 * You can add validators to the FormControl:
 *
 * ```typescript
 * employeesControl = new FormControl([], [
 *   Validators.required,
 *   Validators.minLength(1),
 *   this.customArrayValidator
 * ]);
 * ```
 */
@Directive({
  selector: 'tbw-grid[formControlName], tbw-grid[formControl]',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => GridFormControl),
      multi: true,
    },
  ],
})
export class GridFormControl implements ControlValueAccessor, OnInit, OnDestroy {
  private elementRef = inject(ElementRef<GridElement>);
  // Use Injector to lazily access NgControl and break the circular dependency
  // (NG_VALUE_ACCESSOR -> GridFormControl -> NgControl -> NG_VALUE_ACCESSOR)
  private injector = inject(Injector);
  private _ngControl: NgControl | null = null;
  private cellCommitListener: ((e: Event) => void) | null = null;
  private touchListener: ((e: Event) => void) | null = null;
  private hasValidatedControlType = false;

  /**
   * Lazily get the NgControl to avoid circular dependency during construction.
   */
  private get ngControl(): NgControl | null {
    if (this._ngControl === null) {
      this._ngControl = this.injector.get(NgControl, null, { self: true, optional: true });
    }
    return this._ngControl;
  }

  // Current value (row data array)
  private value: unknown[] = [];

  // Callbacks registered by Angular forms
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private onChange: (value: unknown[]) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private onTouched: () => void = () => {};
  private isDisabled = false;

  ngOnInit(): void {
    // Validate the control type on init
    this.#validateControlType();

    const grid = this.elementRef.nativeElement;
    if (!grid) return;

    // Store the form context on the grid element for other directives to access
    this.#storeFormContext(grid);

    // Intercept cell-commit events to update the form value
    this.cellCommitListener = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this.#handleCellCommit(detail);
    };
    grid.addEventListener('cell-commit', this.cellCommitListener);

    // Mark as touched on first interaction
    this.touchListener = () => {
      this.onTouched();
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
    if (this.touchListener) {
      grid.removeEventListener('click', this.touchListener);
    }

    this.#clearFormContext(grid);
  }

  // ControlValueAccessor implementation

  /**
   * Called by Angular when the form value changes.
   * Updates the grid rows with the new value.
   *
   * @throws Error if the control type is invalid or value is not an array
   */
  writeValue(value: unknown[] | null): void {
    // Validate control type on first writeValue call (ngOnInit may not have run yet)
    if (!this.hasValidatedControlType) {
      this.#validateControlType();
    }

    // At this point, we know the control type is valid (FormArray or FormControl<T[]>)
    // The value should always be an array
    if (value !== null && value !== undefined && !Array.isArray(value)) {
      throw new Error(
        `[GridFormControl] Expected array value but received ${typeof value}. ` +
          `Use FormControl<T[]> with an array value or FormArray for the grid.`,
      );
    }

    this.value = value ?? [];
    const grid = this.elementRef.nativeElement;
    if (grid) {
      grid.rows = this.value;
    }
  }

  /**
   * Called by Angular to register the change callback.
   */
  registerOnChange(fn: (value: unknown[]) => void): void {
    this.onChange = fn;
  }

  /**
   * Called by Angular to register the touched callback.
   */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /**
   * Called by Angular when the disabled state changes.
   */
  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    // TODO: Apply disabled state to grid (prevent editing)
    const grid = this.elementRef.nativeElement;
    if (grid) {
      // Could set a CSS class or property to visually disable
      grid.classList.toggle('form-disabled', isDisabled);
    }
  }

  // Private methods

  /**
   * Checks if the bound control is a FormArray with FormGroup children.
   */
  #isFormArrayOfFormGroups(): boolean {
    const control = this.ngControl?.control;
    if (!(control instanceof FormArray)) return false;
    if (control.length === 0) return false;
    return control.at(0) instanceof FormGroup;
  }

  /**
   * Gets the FormArray, if the control is a FormArray.
   */
  #getFormArray(): FormArray | null {
    const control = this.ngControl?.control;
    return control instanceof FormArray ? control : null;
  }

  /**
   * Stores the FormArrayContext on the grid element.
   */
  #storeFormContext(grid: GridElement): void {
    const getFormArray = () => this.#getFormArray();

    const getRowFormGroup = (rowIndex: number): FormGroup | undefined => {
      const formArray = getFormArray();
      if (!formArray) return undefined;
      const rowControl = formArray.at(rowIndex);
      return rowControl instanceof FormGroup ? rowControl : undefined;
    };

    const context: FormArrayContext = {
      getRow: <T>(rowIndex: number): T | null => {
        return (this.value[rowIndex] as T) ?? null;
      },
      updateField: (rowIndex: number, field: string, value: unknown) => {
        if (this.value[rowIndex]) {
          (this.value[rowIndex] as Record<string, unknown>)[field] = value;
          // Create a new array reference to trigger change detection
          this.value = [...this.value];
          this.onChange(this.value);
        }
      },
      getValue: <T>(): T[] => {
        return this.value as T[];
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
        if (!rowFormGroup) return true; // No form group = assume valid
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

        // Collect errors from all controls in the FormGroup
        Object.keys(rowFormGroup.controls).forEach((field) => {
          const control = rowFormGroup.get(field);
          if (control?.errors) {
            errors[field] = control.errors;
            hasErrors = true;
          }
        });

        // Also include group-level errors if any
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
   * Validates that the bound control is either a FormArray or a FormControl with an array value.
   * Throws a helpful error if the control type is incompatible.
   */
  #validateControlType(): void {
    if (this.hasValidatedControlType) return;
    this.hasValidatedControlType = true;

    const control = this.ngControl?.control;
    if (!control) return; // Control not yet available

    // FormArray is always valid - its value is inherently an array
    if (control instanceof FormArray) {
      return;
    }

    // FormControl is valid only if its value is an array (or null/undefined)
    if (control instanceof FormControl) {
      const value = control.value;
      if (value !== null && value !== undefined && !Array.isArray(value)) {
        throw new Error(
          `[GridFormControl] Invalid FormControl value type. ` +
            `The grid requires an array of row objects, but the FormControl contains a ${typeof value}. ` +
            `Use FormControl<T[]> with an array value, or use FormArray instead.\n\n` +
            `Example with FormControl:\n` +
            `  employeesControl = new FormControl<Employee[]>([{ name: 'Alice' }]);\n\n` +
            `Example with FormArray:\n` +
            `  employeesArray = new FormArray([new FormGroup({ name: new FormControl('Alice') })]);`,
        );
      }
      return;
    }

    // Unknown control type - warn but don't throw
    console.warn(
      `[GridFormControl] Unexpected control type: ${control.constructor.name}. ` +
        `Expected FormControl<T[]> or FormArray.`,
    );
  }

  /**
   * Handles cell-commit events by updating the form value.
   */
  #handleCellCommit(detail: { rowIndex: number; field: string; value: unknown }): void {
    if (this.isDisabled) return;

    const { rowIndex, field, value } = detail;

    if (this.value[rowIndex]) {
      // Update the field value
      (this.value[rowIndex] as Record<string, unknown>)[field] = value;

      // Create a new array reference to trigger change detection
      this.value = [...this.value];

      // Notify Angular forms of the change
      this.onChange(this.value);
    }
  }
}

/**
 * Directive that binds a FormArray directly to the grid.
 *
 * This is the recommended way to integrate tbw-grid with Angular Reactive Forms
 * when using a FormArray of FormGroups for row-level validation and control access.
 *
 * ## Usage
 *
 * ```typescript
 * import { Component } from '@angular/core';
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
 * ## Benefits over GridFormControl
 *
 * - Works naturally with FormArray inside a FormGroup
 * - Provides cell-level FormControl access for validation
 * - Supports row-level validation state aggregation
 */
@Directive({
  selector: 'tbw-grid[formArray]',
})
export class GridFormArray implements OnInit, OnDestroy {
  private elementRef = inject(ElementRef<GridElement>);
  private cellCommitListener: ((e: Event) => void) | null = null;
  private touchListener: ((e: Event) => void) | null = null;

  /**
   * The FormArray to bind to the grid.
   */
  readonly formArray = input.required<FormArray>();

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
  #handleCellCommit(detail: { rowIndex: number; field: string; value: unknown }): void {
    const { rowIndex, field, value } = detail;

    const rowFormGroup = this.#getRowFormGroup(rowIndex);
    if (rowFormGroup) {
      const control = rowFormGroup.get(field);
      if (control) {
        control.setValue(value);
        control.markAsDirty();
        control.markAsTouched();
      }
    }
  }
}
