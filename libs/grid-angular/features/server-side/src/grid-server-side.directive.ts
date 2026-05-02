/**
 * `GridServerSideDirective` — owns `[serverSide]` on `<tbw-grid>`. No
 * event outputs. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeatureClaim, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { ServerSideConfig } from '@toolbox-web/grid/plugins/server-side';

@Directive({
  selector: 'tbw-grid[serverSide]',
  standalone: true,
})
export class GridServerSideDirective implements OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly serverSide = input<ServerSideConfig>();

  constructor() {
    registerFeatureClaim(this.elementRef.nativeElement, 'serverSide', () => this.serverSide());
  }

  ngOnDestroy(): void {
    unregisterFeatureClaim(this.elementRef.nativeElement, 'serverSide');
  }
}
