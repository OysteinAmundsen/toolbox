/**
 * `GridExportDirective` — owns the `export` input (template alias of
 * `exportFeature`) and `(exportComplete)` on `<tbw-grid>`. See
 * `GridFilteringDirective` for the full rationale.
 *
 * The TypeScript field is `exportFeature` (with `alias: 'export'`) because
 * `export` is a reserved keyword. Templates use `[export]` / `(exportComplete)`
 * exactly as before.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { ExportCompleteDetail, ExportConfig } from '@toolbox-web/grid/plugins/export';

@Directive({
  selector: 'tbw-grid[export], tbw-grid[exportComplete]',
  standalone: true,
})
export class GridExportDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly exportFeature = input<boolean | ExportConfig>(undefined, { alias: 'export' });
  readonly exportComplete = output<ExportCompleteDetail>();

  private listener?: (e: Event) => void;

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'export', () => this.exportFeature());
    claimEvent(grid, 'export-complete');
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    this.listener = (e: Event): void => this.exportComplete.emit((e as CustomEvent<ExportCompleteDetail>).detail);
    grid.addEventListener('export-complete', this.listener);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    if (this.listener) {
      grid.removeEventListener('export-complete', this.listener);
      this.listener = undefined;
    }
    unregisterFeatureClaim(grid, 'export');
    unclaimEvent(grid, 'export-complete');
  }
}
