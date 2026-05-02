/**
 * `GridPinnedRowsDirective` — owns `[pinnedRows]` on `<tbw-grid>`. No
 * event outputs. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeatureClaim, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { PinnedRowsConfig } from '@toolbox-web/grid/plugins/pinned-rows';

/**
 * Owns the binding(s) `[pinnedRows]` on `<tbw-grid>` for the matching feature plugin. See {@link GridFilteringDirective} for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[pinnedRows]',
  standalone: true,
})
export class GridPinnedRowsDirective implements OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly pinnedRows = input<boolean | PinnedRowsConfig>();

  constructor() {
    registerFeatureClaim(this.elementRef.nativeElement, 'pinnedRows', () => this.pinnedRows());
  }

  ngOnDestroy(): void {
    unregisterFeatureClaim(this.elementRef.nativeElement, 'pinnedRows');
  }
}
