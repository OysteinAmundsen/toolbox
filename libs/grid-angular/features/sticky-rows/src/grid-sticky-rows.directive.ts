/**
 * `GridStickyRowsDirective` — owns `[stickyRows]` on `<tbw-grid>`.
 * No event outputs. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeatureClaim, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { StickyRowsConfig } from '@toolbox-web/grid/plugins/sticky-rows';

/**
 * Owns the binding `[stickyRows]` on `<tbw-grid>` for the matching feature plugin.
 * See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[stickyRows]',
  standalone: true,
})
export class GridStickyRowsDirective implements OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly stickyRows = input<StickyRowsConfig>();

  constructor() {
    registerFeatureClaim(this.elementRef.nativeElement, 'stickyRows', () => this.stickyRows());
  }

  ngOnDestroy(): void {
    unregisterFeatureClaim(this.elementRef.nativeElement, 'stickyRows');
  }
}
