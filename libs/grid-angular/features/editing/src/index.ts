/**
 * Editing feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `editing` input on Grid directive AND to
 * install the `before-edit-close` blur bridge that flushes pending input from
 * Angular editors that commit on `(blur)` before the cell DOM is torn down by
 * Tab / programmatic row exit.
 *
 * Without this import, Angular `(blur)`-committing editors silently lose
 * pending input on programmatic row exit.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/editing';
 *
 * <tbw-grid [editing]="'dblclick'" />
 * ```
 *
 * @packageDocumentation
 */

import type { TemplateRef } from '@angular/core';
import type { ColumnEditorContext, ColumnEditorSpec } from '@toolbox-web/grid';
import {
  type GridAdapter,
  makeFlushFocusedInput,
  registerEditorMountHook,
  registerEditorSpecBridge,
} from '@toolbox-web/grid-angular';
import '@toolbox-web/grid/features/editing';
import { getEditorTemplate, type GridEditorContext } from './grid-column-editor.directive';
import { getFormArrayContext } from './grid-form-array.directive';
import { getStructuralEditorTemplate } from './structural-editor.directive';

export { GridEditingDirective } from './grid-editing.directive';
export type { _Augmentation as _EditingAugmentation } from '@toolbox-web/grid/features/editing';

// ---------------------------------------------------------------------------
// Editing-owned public API. These symbols physically live in this secondary
// entry; the grid core only exposes generic embedded-view primitives and
// delegates all template-editor resolution to the bridge installed below.
// ---------------------------------------------------------------------------
export { BaseGridEditor } from './base-grid-editor';
export { BaseGridEditorCVA } from './base-grid-editor-cva';
export { BaseOverlayEditor } from './base-overlay-editor';
export type { OverlayPosition } from './base-overlay-editor';
export { getEditorTemplate, GridColumnEditor } from './grid-column-editor.directive';
export type { GridEditorContext } from './grid-column-editor.directive';
export { getFormArrayContext, GridFormArray } from './grid-form-array.directive';
export type { FormArrayContext } from './grid-form-array.directive';
export { getLazyFormContext, GridLazyForm } from './grid-lazy-form.directive';
export type { LazyFormFactory, RowFormChangeEvent } from './grid-lazy-form.directive';
export { getStructuralEditorTemplate, TbwEditor } from './structural-editor.directive';
export type { StructuralEditorContext } from './structural-editor.directive';

// ---------------------------------------------------------------------------
// Install the template-based editor bridge. The grid adapter delegates
// `createEditor()` / `canHandle()` to this function, which resolves the
// Angular editor template (`*tbwEditor` or nested `<tbw-grid-column-editor>`),
// wires the FormArray control (if the grid is bound to a FormArray), and
// mounts the template via the adapter's generic editor-view primitive.
// ---------------------------------------------------------------------------
registerEditorSpecBridge(
  <TRow, TValue>(element: HTMLElement, adapter: GridAdapter): ColumnEditorSpec<TRow, TValue> | undefined => {
    // Resolve the editor template: structural `*tbwEditor` first, then the
    // nested `<tbw-grid-column-editor>` directive.
    const template = (getStructuralEditorTemplate(element) ?? getEditorTemplate(element)) as
      | TemplateRef<GridEditorContext<TValue, TRow>>
      | undefined;

    if (!template) {
      // No template registered — let the grid use its built-in editors. This
      // allows columns with only `*tbwRenderer` (no `*tbwEditor`) to remain
      // editable via the default text/number/boolean editors.
      return undefined;
    }

    // Find the parent grid element for FormArray context access.
    const gridElement = element.closest('tbw-grid, [data-tbw-grid]') as HTMLElement | null;

    return (ctx: ColumnEditorContext<TRow, TValue>) => {
      const onCommit = (value: TValue) => ctx.commit(value);
      const onCancel = () => ctx.cancel();

      // Resolve the FormControl from the FormArrayContext, if available.
      let control: GridEditorContext<TValue, TRow>['control'];
      if (gridElement) {
        const formContext = getFormArrayContext(gridElement);
        if (formContext?.hasFormGroups) {
          const gridRows = (gridElement as { rows?: TRow[] }).rows;
          if (gridRows) {
            const rowIndex = gridRows.indexOf(ctx.row);
            if (rowIndex >= 0) {
              control = formContext.getControl(rowIndex, ctx.field as string);
            }
          }
        }
      }

      const context: GridEditorContext<TValue, TRow> = {
        $implicit: ctx.value,
        value: ctx.value,
        row: ctx.row,
        field: ctx.field as string,
        column: ctx.column,
        rowId: ctx.rowId ?? '',
        onCommit,
        onCancel,
        updateRow: ctx.updateRow,
        onValueChange: ctx.onValueChange,
        control,
      };

      // Mount the template via the adapter's generic editor-view primitive
      // (tracks the view in the per-cell editor pool, wraps root nodes in a
      // stable `display:contents` span, and runs editor-mount hooks).
      const { container, viewRef } = adapter.createEditorTemplateView(template, context);

      // Auto-wire: listen for commit/cancel events on the rendered component so
      // components can just emit `(commit)` / `(cancel)` without explicit
      // template bindings.
      container.addEventListener('commit', (e: Event) => {
        ctx.commit((e as CustomEvent<TValue>).detail);
      });
      container.addEventListener('cancel', () => {
        ctx.cancel();
      });

      // Auto-update the editor when the value changes externally (e.g. updateRow
      // cascade or Escape-revert). Angular's own bindings/control flow handle the
      // re-render; we just re-sync root nodes in case control flow changed them.
      ctx.onValueChange?.((newVal: unknown) => {
        context.$implicit = newVal as TValue;
        context.value = newVal as TValue;
        viewRef.detectChanges();
        adapter.syncEditorTemplateView(viewRef, container);
      });

      return container;
    };
  },
);

// Bridge the editing plugin's `before-edit-close` event to a synchronous
// `.blur()` on the focused input/textarea/select inside the editor host.
// Angular editors that commit on `(blur)` rely on the focused control firing
// blur naturally, but Tab / programmatic row exit rebuilds the cell DOM
// synchronously without giving the focused control a chance to blur first.
registerEditorMountHook(({ container, gridEl }) => {
  const flush = makeFlushFocusedInput(container);
  gridEl.addEventListener('before-edit-close', flush);
  return () => gridEl.removeEventListener('before-edit-close', flush);
});
