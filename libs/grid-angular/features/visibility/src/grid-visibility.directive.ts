/**
 * `GridVisibilityDirective` — owns `[visibility]` and `(columnVisibility)`
 * on `<tbw-grid>`. The `(columnStateChange)` output stays on `Grid`
 * because it covers a broader set of column-state mutations beyond just
 * visibility toggles. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { ColumnVisibilityDetail, VisibilityConfig } from '@toolbox-web/grid/plugins/visibility';

/**
 * Owns the binding(s) `[visibility], [columnVisibility]` on `<tbw-grid>` for the matching feature plugin. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[visibility], tbw-grid[columnVisibility]',
  standalone: true,
})
export class GridVisibilityDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly visibility = input<boolean | VisibilityConfig>();
  readonly columnVisibility = output<ColumnVisibilityDetail>();

  private listener?: (e: Event) => void;

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'visibility', () => this.visibility());
    claimEvent(grid, 'column-visibility');
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    this.listener = (e: Event): void => this.columnVisibility.emit((e as CustomEvent<ColumnVisibilityDetail>).detail);
    grid.addEventListener('column-visibility', this.listener);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    if (this.listener) {
      grid.removeEventListener('column-visibility', this.listener);
      this.listener = undefined;
    }
    unregisterFeatureClaim(grid, 'visibility');
    unclaimEvent(grid, 'column-visibility');
  }
}
