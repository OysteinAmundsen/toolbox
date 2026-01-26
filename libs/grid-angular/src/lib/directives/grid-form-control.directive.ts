import { Directive, ElementRef, forwardRef, inject, OnDestroy, OnInit } from '@angular/core';
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
  private ngControl = inject(NgControl, { self: true, optional: true });
  private cellCommitListener: ((e: Event) => void) | null = null;
  private touchListener: ((e: Event) => void) | null = null;
  private hasValidatedControlType = false;

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
        const formArray = this.#getFormArray();
        if (!formArray) return undefined;

        const rowControl = formArray.at(rowIndex);
        if (!(rowControl instanceof FormGroup)) return undefined;

        return rowControl.get(field) ?? undefined;
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
