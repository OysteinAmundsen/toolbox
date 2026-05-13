/**
 * `GridReorderColumnsDirective` — owns `[reorderColumns]` and
 * `(columnMove)` on `<tbw-grid>`. See `GridFilteringDirective` for the
 * full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { ColumnMoveDetail, ReorderConfig } from '@toolbox-web/grid/plugins/reorder-columns';

/**
 * Owns the binding(s) `[reorderColumns], [columnMove]` on `<tbw-grid>` for the matching feature plugin. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[reorderColumns], tbw-grid[columnMove]',
  standalone: true,
})
export class GridReorderColumnsDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly reorderColumns = input<boolean | ReorderConfig>();
  readonly columnMove = output<ColumnMoveDetail>();

  private listener?: (e: Event) => void;

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'reorderColumns', () => this.reorderColumns());
    claimEvent(grid, 'column-move');
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    this.listener = (e: Event): void => this.columnMove.emit((e as CustomEvent<ColumnMoveDetail>).detail);
    grid.addEventListener('column-move', this.listener);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    if (this.listener) {
      grid.removeEventListener('column-move', this.listener);
      this.listener = undefined;
    }
    unregisterFeatureClaim(grid, 'reorderColumns');
    unclaimEvent(grid, 'column-move');
  }
}
