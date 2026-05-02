/**
 * `GridMasterDetailDirective` — owns `[masterDetail]` and `(detailExpand)`
 * on `<tbw-grid>`. See `GridFilteringDirective` for the full rationale.
 *
 * Note: this directive is independent of the higher-level
 * `<tbw-grid-detail>` template element + `GridDetailView` wrapper, which
 * uses a different bridging mechanism (template registration). Apps using
 * the template form do not need this directive.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { DetailExpandDetail, MasterDetailConfig } from '@toolbox-web/grid/plugins/master-detail';

/**
 * Owns the binding(s) `[masterDetail], [detailExpand]` on `<tbw-grid>` for the matching feature plugin. See {@link GridFilteringDirective} for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[masterDetail], tbw-grid[detailExpand]',
  standalone: true,
})
export class GridMasterDetailDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly masterDetail = input<MasterDetailConfig>();
  readonly detailExpand = output<DetailExpandDetail>();

  private listener?: (e: Event) => void;

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'masterDetail', () => this.masterDetail());
    claimEvent(grid, 'detail-expand');
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    this.listener = (e: Event): void => this.detailExpand.emit((e as CustomEvent<DetailExpandDetail>).detail);
    grid.addEventListener('detail-expand', this.listener);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    if (this.listener) {
      grid.removeEventListener('detail-expand', this.listener);
      this.listener = undefined;
    }
    unregisterFeatureClaim(grid, 'masterDetail');
    unclaimEvent(grid, 'detail-expand');
  }
}
