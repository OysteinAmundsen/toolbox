/**
 * `GridReorderRowsDirective` — owns `[reorderRows]` on `<tbw-grid>`.
 *
 * `reorderRows` is a deprecated alias of `rowDragDrop`. This directive
 * claims the alias input only — it does NOT claim any row-drag-drop
 * events. The `GridRowDragDropDirective` owns all row-* events. This
 * keeps event ownership single-source and avoids duplicate listeners
 * when both directives are imported (which is harmless but wasteful).
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeatureClaim, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { RowReorderConfig } from '@toolbox-web/grid/plugins/reorder-rows';

/**
 * Owns the binding(s) `[reorderRows]` on `<tbw-grid>` for the matching feature plugin. See `GridFilteringDirective` for the full rationale.
 *
 * @deprecated v1.x — slated for removal in `@toolbox-web/grid-angular` 2.0.0
 * (coordinated v3.0.0 release, see gh #260 / #263). Use `GridRowDragDropDirective`
 * (binds `[rowDragDrop]`) instead.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[reorderRows]',
  standalone: true,
})
export class GridReorderRowsDirective implements OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly reorderRows = input<boolean | RowReorderConfig>();

  constructor() {
    registerFeatureClaim(this.elementRef.nativeElement, 'reorderRows', () => this.reorderRows());
  }

  ngOnDestroy(): void {
    unregisterFeatureClaim(this.elementRef.nativeElement, 'reorderRows');
  }
}
