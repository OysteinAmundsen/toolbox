/**
 * `GridMasterDetailDirective` — owns `[masterDetail]`, `(detailExpand)` and
 * `(detailLoadError)` on `<tbw-grid>`. See `GridFilteringDirective` for the
 * full rationale.
 *
 * Note: this directive is independent of the higher-level
 * `<tbw-grid-detail>` template element + `GridDetailView` wrapper, which
 * uses a different bridging mechanism (template registration). Apps using
 * the template form do not need this directive.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output, type Type } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type {
  MasterDetailConfig as CoreMasterDetailConfig,
  DetailExpandDetail,
  DetailLoadErrorDetail,
} from '@toolbox-web/grid/plugins/master-detail';

/**
 * Angular-specific master-detail config that allows an Angular component class
 * as `detailRenderer`.
 *
 * Extends the core `MasterDetailConfig` to accept a `Type<unknown>` for
 * `detailRenderer` in addition to the vanilla
 * `(row, rowIndex) => HTMLElement | string` signature. Bridging to vanilla
 * DOM is handled by the side-effect import
 * `@toolbox-web/grid-angular/features/master-detail`.
 *
 * Re-exported from the feature entry under the same name as the core type
 * so Angular consumers see a single canonical `MasterDetailConfig` from
 * `@toolbox-web/grid-angular/features/master-detail`.
 *
 * @since 1.7.1
 */
export type MasterDetailConfig = Omit<CoreMasterDetailConfig, 'detailRenderer'> & {
  detailRenderer?: CoreMasterDetailConfig['detailRenderer'] | Type<unknown>;
};

/**
 * Owns the binding(s) `[masterDetail], [detailExpand], [detailLoadError]` on `<tbw-grid>` for the matching feature plugin. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[masterDetail], tbw-grid[detailExpand], tbw-grid[detailLoadError]',
  standalone: true,
})
export class GridMasterDetailDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly masterDetail = input<MasterDetailConfig>();
  readonly detailExpand = output<DetailExpandDetail>();
  /**
   * Fired when loading detail data through the ServerSide data source
   * (`getChildRows()`) fails. Re-expanding the row retries the fetch.
   *
   * @since 2.7.0
   */
  readonly detailLoadError = output<DetailLoadErrorDetail>();

  private readonly listeners = new Map<string, (e: Event) => void>();
  private static readonly EVENTS = ['detail-expand', 'detail-load-error'] as const;

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'masterDetail', () => this.masterDetail());
    for (const ev of GridMasterDetailDirective.EVENTS) claimEvent(grid, ev);
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    const wire = <T>(name: string, out: { emit: (v: T) => void }): void => {
      const l = (e: Event): void => out.emit((e as CustomEvent<T>).detail);
      grid.addEventListener(name, l);
      this.listeners.set(name, l);
    };
    wire<DetailExpandDetail>('detail-expand', this.detailExpand);
    wire<DetailLoadErrorDetail>('detail-load-error', this.detailLoadError);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    for (const [name, l] of this.listeners) grid.removeEventListener(name, l);
    this.listeners.clear();
    unregisterFeatureClaim(grid, 'masterDetail');
    for (const ev of GridMasterDetailDirective.EVENTS) unclaimEvent(grid, ev);
  }
}
