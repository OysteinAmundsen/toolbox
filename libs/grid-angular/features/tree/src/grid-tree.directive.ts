/**
 * `GridTreeDirective` — owns `[tree]` and `(treeExpand)` on `<tbw-grid>`.
 * See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { TreeConfig, TreeExpandDetail } from '@toolbox-web/grid/plugins/tree';

/**
 * Owns the binding(s) `[tree], [treeExpand]` on `<tbw-grid>` for the matching feature plugin. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[tree], tbw-grid[treeExpand]',
  standalone: true,
})
export class GridTreeDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly tree = input<boolean | TreeConfig>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly treeExpand = output<TreeExpandDetail<any>>();

  private listener?: (e: Event) => void;

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'tree', () => this.tree());
    claimEvent(grid, 'tree-expand');
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.listener = (e: Event): void => this.treeExpand.emit((e as CustomEvent<TreeExpandDetail<any>>).detail);
    grid.addEventListener('tree-expand', this.listener);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    if (this.listener) {
      grid.removeEventListener('tree-expand', this.listener);
      this.listener = undefined;
    }
    unregisterFeatureClaim(grid, 'tree');
    unclaimEvent(grid, 'tree-expand');
  }
}
