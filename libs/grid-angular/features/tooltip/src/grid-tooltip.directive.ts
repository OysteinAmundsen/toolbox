/**
 * `GridTooltipDirective` — owns `[tooltip]` on `<tbw-grid>`. No event
 * outputs. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeatureClaim, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { TooltipConfig } from '@toolbox-web/grid/plugins/tooltip';

@Directive({
  selector: 'tbw-grid[tooltip]',
  standalone: true,
})
export class GridTooltipDirective implements OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly tooltip = input<boolean | TooltipConfig>();

  constructor() {
    registerFeatureClaim(this.elementRef.nativeElement, 'tooltip', () => this.tooltip());
  }

  ngOnDestroy(): void {
    unregisterFeatureClaim(this.elementRef.nativeElement, 'tooltip');
  }
}
