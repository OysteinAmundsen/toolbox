import { afterNextRender, computed, DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';
import type { AbstractControl } from '@angular/forms';
import type { ColumnConfig } from '@toolbox-web/grid';

/**
 * Base class for grid cell editors.
 *
 * Provides common functionality for Angular cell editors:
 * - Automatic value resolution from FormControl or value input
 * - Common inputs (value, row, column, control)
 * - Common outputs (commit, cancel)
 * - Validation state helpers
 *
 * ## Usage
 *
 * ```typescript
 * import { Component } from '@angular/core';
 * import { BaseGridEditor } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-my-editor',
 *   template: \`
 *     <input
 *       [value]="currentValue()"
 *       [class.is-invalid]="isInvalid()"
 *       (input)="commitValue($event.target.value)"
 *       (keydown.escape)="cancelEdit()"
 *     />
 *     @if (hasErrors()) {
 *       <div class="error">{{ firstErrorMessage() }}</div>
 *     }
 *   \`
 * })
 * export class MyEditorComponent extends BaseGridEditor<MyRow, string> {
 *   // Override to customize error messages
 *   protected override getErrorMessage(errorKey: string): string {
 *     if (errorKey === 'required') return 'This field is required';
 *     if (errorKey === 'minlength') return 'Too short';
 *     return super.getErrorMessage(errorKey);
 *   }
 * }
 * ```
 *
 * ## Template Syntax
 *
 * When using the base class, you only need to pass the control:
 *
 * ```html
 * <tbw-grid-column field="name">
 *   <app-my-editor *tbwEditor="let _; control as control" [control]="control" />
 * </tbw-grid-column>
 * ```
 *
 * Or without FormArray binding (fallback to value):
 *
 * ```html
 * <tbw-grid-column field="name">
 *   <app-my-editor *tbwEditor="let value" [value]="value" />
 * </tbw-grid-column>
 * ```
 *
 * @typeParam TRow - The row data type
 * @typeParam TValue - The cell value type
 */
@Directive()
export abstract class BaseGridEditor<TRow = unknown, TValue = unknown> {
  protected readonly elementRef = inject(ElementRef);
  private readonly _destroyRef = inject(DestroyRef);

  /** Cleanup function for the edit-close listener */
  private _editCloseCleanup: (() => void) | null = null;

  // ============================================================================
  // Inputs
  // ============================================================================

  /**
   * The cell value. Used when FormControl is not available.
   * When a FormControl is provided, value is derived from control.value instead.
   */
  readonly value = input<TValue>();

  /**
   * The full row data object.
   */
  readonly row = input<TRow>();

  /**
   * The column configuration.
   */
  readonly column = input<ColumnConfig<TRow>>();

  /**
   * The FormControl for this cell, if the grid is bound to a FormArray.
   * When provided, the editor uses control.value instead of the value input.
   */
  readonly control = input<AbstractControl>();

  // ============================================================================
  // Outputs
  // ============================================================================

  /**
   * Emits when the user commits a new value.
   */
  readonly commit = output<TValue>();

  /**
   * Emits when the user cancels editing.
   */
  readonly cancel = output<void>();

  // ============================================================================
  // Computed State
  // ============================================================================

  /**
   * The current value, derived from FormControl if available, otherwise from value input.
   * This is the recommended way to get the current value in your editor template.
   */
  readonly currentValue = computed<TValue | undefined>(() => {
    const ctrl = this.control();
    if (ctrl) {
      return ctrl.value as TValue;
    }
    return this.value();
  });

  /**
   * Whether the control is invalid (has validation errors).
   * Returns false if no FormControl is available.
   */
  readonly isInvalid = computed(() => {
    return this.control()?.invalid ?? false;
  });

  /**
   * Whether the control is dirty (has been modified).
   * Returns false if no FormControl is available.
   */
  readonly isDirty = computed(() => {
    return this.control()?.dirty ?? false;
  });

  /**
   * Whether the control has been touched.
   * Returns false if no FormControl is available.
   */
  readonly isTouched = computed(() => {
    return this.control()?.touched ?? false;
  });

  /**
   * Whether the control has any validation errors.
   */
  readonly hasErrors = computed(() => {
    const ctrl = this.control();
    return ctrl?.errors != null && Object.keys(ctrl.errors).length > 0;
  });

  /**
   * The first error message from the control's validation errors.
   * Returns an empty string if no errors.
   */
  readonly firstErrorMessage = computed(() => {
    const ctrl = this.control();
    if (!ctrl?.errors) return '';

    const firstKey = Object.keys(ctrl.errors)[0];
    return this.getErrorMessage(firstKey, ctrl.errors[firstKey]);
  });

  /**
   * All error messages from the control's validation errors.
   */
  readonly allErrorMessages = computed(() => {
    const ctrl = this.control();
    if (!ctrl?.errors) return [];

    return Object.entries(ctrl.errors).map(([key, value]) => this.getErrorMessage(key, value));
  });

  // ============================================================================
  // Lifecycle
  // ============================================================================

  constructor() {
    afterNextRender(() => this._initEditCloseListener());
    this._destroyRef.onDestroy(() => {
      this._editCloseCleanup?.();
      this._editCloseCleanup = null;
    });
  }

  private _initEditCloseListener(): void {
    const grid = this.elementRef.nativeElement.closest('tbw-grid');
    if (!grid) return;

    const beforeHandler = () => this.onBeforeEditClose();
    grid.addEventListener('before-edit-close', beforeHandler, { once: true });

    const handler = () => this.onEditClose();
    grid.addEventListener('edit-close', handler, { once: true });
    this._editCloseCleanup = () => {
      grid.removeEventListener('before-edit-close', beforeHandler);
      grid.removeEventListener('edit-close', handler);
    };
  }

  // ============================================================================
  // Methods
  // ============================================================================

  /**
   * Whether this editor's cell is the currently focused cell.
   *
   * In row editing mode the grid creates editors for every editable cell
   * in the row simultaneously. Use this to conditionally auto-focus inputs
   * or open panels only in the active cell.
   *
   * Performs a synchronous DOM check — safe to call from `ngAfterViewInit`.
   */
  protected isCellFocused(): boolean {
    return this.elementRef.nativeElement.closest('[part="cell"]')?.classList.contains('cell-focus') ?? false;
  }

  /**
   * Called **before** the grid clears editing state and destroys editor DOM.
   *
   * At this point the commit callback is still active, so subclasses can
   * call {@link commitValue} to flush any pending/deferred values.
   *
   * This fires only on the **commit** path (not on revert/cancel).
   * Use {@link onEditClose} for cleanup that should happen on both paths.
   */
  protected onBeforeEditClose(): void {
    // Default: no-op. Subclasses override to flush pending values.
  }

  /**
   * Called when the grid ends the editing session for this cell.
   *
   * Override to perform cleanup such as closing overlay panels, autocomplete
   * dropdowns, or other floating UI that lives at `<body>` level and would
   * otherwise persist after the editor DOM is removed.
   *
   * The listener is set up automatically via `afterNextRender` — no manual
   * wiring required.
   */
  protected onEditClose(): void {
    // Default: no-op. Subclasses override.
  }

  /**
   * Called by the grid adapter when the cell value changes externally
   * (e.g., via `updateRow()` cascade or undo/redo).
   *
   * Override in subclasses to reset internal state (search text, selection
   * flags, etc.) so the editor displays the updated value.
   *
   * This runs **synchronously** before the value input is updated, giving
   * the editor a chance to clear stale state before the next change-detection
   * pass re-reads the template.
   *
   * @param _newVal The new cell value being pushed from the grid
   */
  onExternalValueChange(_newVal: TValue): void {
    // Default: no-op. Subclasses override as needed.
  }

  /**
   * Commit a new value. Emits the commit output AND dispatches a DOM event.
   * The DOM event enables the grid's auto-wiring to catch the commit.
   * Call this when the user confirms their edit.
   */
  commitValue(newValue: TValue): void {
    // Emit Angular output for template bindings
    this.commit.emit(newValue);

    // Dispatch DOM CustomEvent for grid's auto-wiring
    // This allows the adapter to catch commits without explicit (commit)="..." bindings
    this.elementRef.nativeElement.dispatchEvent(new CustomEvent('commit', { detail: newValue, bubbles: true }));
  }

  /**
   * Cancel editing. Emits the cancel output AND dispatches a DOM event.
   * Call this when the user cancels (e.g., presses Escape).
   */
  cancelEdit(): void {
    // Emit Angular output for template bindings
    this.cancel.emit();

    // Dispatch DOM CustomEvent for grid's auto-wiring
    this.elementRef.nativeElement.dispatchEvent(new CustomEvent('cancel', { bubbles: true }));
  }

  /**
   * Get a human-readable error message for a validation error.
   * Override this method to customize error messages for your editor.
   *
   * @param errorKey - The validation error key (e.g., 'required', 'minlength')
   * @param errorValue - The error value (e.g., { requiredLength: 5, actualLength: 3 })
   * @returns A human-readable error message
   */
  protected getErrorMessage(errorKey: string, errorValue?: unknown): string {
    switch (errorKey) {
      case 'required':
        return 'This field is required';
      case 'minlength': {
        const err = errorValue as { requiredLength?: number };
        return `Minimum length is ${err?.requiredLength ?? 'unknown'}`;
      }
      case 'maxlength': {
        const err = errorValue as { requiredLength?: number };
        return `Maximum length is ${err?.requiredLength ?? 'unknown'}`;
      }
      case 'min': {
        const err = errorValue as { min?: number };
        return `Minimum value is ${err?.min ?? 'unknown'}`;
      }
      case 'max': {
        const err = errorValue as { max?: number };
        return `Maximum value is ${err?.max ?? 'unknown'}`;
      }
      case 'email':
        return 'Invalid email address';
      case 'pattern':
        return 'Invalid format';
      default:
        return `Invalid value (${errorKey})`;
    }
  }
}
