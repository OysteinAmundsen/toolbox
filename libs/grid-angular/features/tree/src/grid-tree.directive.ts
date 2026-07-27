/**
 * `GridTreeDirective` — owns `[tree]` and the tree outputs on `<tbw-grid>`.
 * See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type {
  TreeConfig,
  TreeExpandDetail,
  TreeLoadEndDetail,
  TreeLoadErrorDetail,
  TreeLoadStartDetail,
} from '@toolbox-web/grid/plugins/tree';

/**
 * Owns the binding(s) `[tree], [treeExpand], [treeLoadStart], [treeLoadEnd], [treeLoadError]` on `<tbw-grid>` for the matching feature plugin. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector:
    'tbw-grid[tree], tbw-grid[treeExpand], tbw-grid[treeLoadStart], tbw-grid[treeLoadEnd], tbw-grid[treeLoadError]',
  standalone: true,
})
export class GridTreeDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly tree = input<boolean | TreeConfig>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly treeExpand = output<TreeExpandDetail<any>>();
  /**
   * Fired when lazy child loading starts for a tree node.
   *
   * @since 2.3.0
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly treeLoadStart = output<TreeLoadStartDetail<any>>();
  /**
   * Fired when lazy child loading completes and children are merged into the parent row.
   *
   * @since 2.3.0
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly treeLoadEnd = output<TreeLoadEndDetail<any>>();
  /**
   * Fired when lazy child loading fails. Re-expanding the node retries the fetch.
   *
   * @since 2.3.0
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly treeLoadError = output<TreeLoadErrorDetail<any>>();

  private readonly listeners = new Map<string, (e: Event) => void>();
  private static readonly EVENTS = ['tree-expand', 'tree-load-start', 'tree-load-end', 'tree-load-error'] as const;

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'tree', () => this.tree());
    for (const ev of GridTreeDirective.EVENTS) claimEvent(grid, ev);
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    const wire = <T>(name: string, out: { emit: (v: T) => void }): void => {
      const l = (e: Event): void => out.emit((e as CustomEvent<T>).detail);
      grid.addEventListener(name, l);
      this.listeners.set(name, l);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wire<TreeExpandDetail<any>>('tree-expand', this.treeExpand);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wire<TreeLoadStartDetail<any>>('tree-load-start', this.treeLoadStart);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wire<TreeLoadEndDetail<any>>('tree-load-end', this.treeLoadEnd);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wire<TreeLoadErrorDetail<any>>('tree-load-error', this.treeLoadError);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    for (const [name, l] of this.listeners) grid.removeEventListener(name, l);
    this.listeners.clear();
    unregisterFeatureClaim(grid, 'tree');
    for (const ev of GridTreeDirective.EVENTS) unclaimEvent(grid, ev);
  }
}
