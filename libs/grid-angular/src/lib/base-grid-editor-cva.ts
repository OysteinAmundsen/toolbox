import { computed, Directive, signal } from '@angular/core';
import type { ControlValueAccessor } from '@angular/forms';
import { BaseGridEditor } from './base-grid-editor';

/**
 * Base class for grid editors that also work as Angular form controls.
 *
 * Combines `BaseGridEditor` with `ControlValueAccessor` so the same component
 * can be used inside a `<tbw-grid>` **and** in a standalone `<form>`.
 *
 * ## What it provides
 *
 * | Member | Purpose |
 * |--------|---------|
 * | `cvaValue` | Signal holding the value written by the form control |
 * | `disabledState` | Signal tracking `setDisabledState` calls |
 * | `displayValue` | Computed that prefers grid value (`currentValue`) and falls back to `cvaValue` |
 * | `commitBoth(v)` | Commits via both CVA `onChange` and grid `commitValue` |
 * | `writeValue` / `registerOn*` / `setDisabledState` | Full CVA implementation |
 *
 * ## Usage
 *
 * ```typescript
 * import { Component, forwardRef } from '@angular/core';
 * import { NG_VALUE_ACCESSOR } from '@angular/forms';
 * import { BaseGridEditorCVA } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-date-picker',
 *   providers: [{
 *     provide: NG_VALUE_ACCESSOR,
 *     useExisting: forwardRef(() => DatePickerComponent),
 *     multi: true,
 *   }],
 *   template: `
 *     <input
 *       type="date"
 *       [value]="displayValue()"
 *       [disabled]="disabledState()"
 *       (change)="commitBoth($event.target.value)"
 *       (keydown.escape)="cancelEdit()"
 *     />
 *   `
 * })
 * export class DatePickerComponent extends BaseGridEditorCVA<MyRow, string> {}
 * ```
 *
 * > **Note:** Subclasses must still provide `NG_VALUE_ACCESSOR` themselves
 * > because `forwardRef(() => ConcreteClass)` must reference the concrete
 * > component — this is an Angular limitation.
 *
 * @typeParam TRow - The row data type
 * @typeParam TValue - The cell/control value type
 */
@Directive()
export abstract class BaseGridEditorCVA<TRow = unknown, TValue = unknown>
  extends BaseGridEditor<TRow, TValue>
  implements ControlValueAccessor
{
  // ============================================================================
  // CVA State
  // ============================================================================

  /** Internal onChange callback registered by the form control. */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private _onChange: (value: TValue | null) => void = () => {};

  /** Internal onTouched callback registered by the form control. */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private _onTouched: () => void = () => {};

  /**
   * Signal holding the value written by the form control via `writeValue()`.
   * Updated when the form control pushes a new value (e.g. `patchValue`, `setValue`).
   */
  protected readonly cvaValue = signal<TValue | null>(null);

  /**
   * Signal tracking the disabled state set by the form control.
   * Updated when `setDisabledState()` is called by Angular's forms module.
   */
  readonly disabledState = signal(false);

  /**
   * Resolved display value.
   *
   * Prefers `currentValue()` (grid context — from `control.value` or `value` input)
   * and falls back to `cvaValue()` (standalone form context — from `writeValue`).
   *
   * Use this in your template instead of reading `currentValue()` directly
   * so the component works in both grid and standalone form contexts.
   */
  readonly displayValue = computed<TValue | null>(() => {
    return (this.currentValue() as TValue | undefined) ?? this.cvaValue();
  });

  // ============================================================================
  // ControlValueAccessor Implementation
  // ============================================================================

  /**
   * Called by Angular forms when the form control value changes programmatically.
   */
  writeValue(value: TValue | null): void {
    this.cvaValue.set(value);
  }

  /**
   * Called by Angular forms to register a change callback.
   */
  registerOnChange(fn: (value: TValue | null) => void): void {
    this._onChange = fn;
  }

  /**
   * Called by Angular forms to register a touched callback.
   */
  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  /**
   * Called by Angular forms to set the disabled state.
   */
  setDisabledState(isDisabled: boolean): void {
    this.disabledState.set(isDisabled);
  }

  // ============================================================================
  // Dual-Commit Helpers
  // ============================================================================

  /**
   * Commit a value through both the CVA (form control) and the grid.
   *
   * - Calls the CVA `onChange` callback (updates the form control)
   * - Marks the control as touched
   * - Calls `commitValue()` (emits grid commit event + DOM `CustomEvent`)
   *
   * Use this instead of `commitValue()` when your editor doubles as a form control.
   *
   * @param value - The new value to commit
   */
  protected commitBoth(value: TValue | null): void {
    // Update CVA
    this.cvaValue.set(value);
    this._onChange(value);
    this._onTouched();

    // Update grid
    if (value != null) {
      this.commitValue(value);
    }
  }
}
