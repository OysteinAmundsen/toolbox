/**
 * `GridGroupingRowsDirective` — owns `[groupingRows]` and the group
 * toggle/expand/collapse outputs on `<tbw-grid>`. See
 * `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type {
  GroupCollapseDetail,
  GroupExpandDetail,
  GroupingRowsConfig,
  GroupToggleDetail,
} from '@toolbox-web/grid/plugins/grouping-rows';

/**
 * Owns the binding(s) `[groupingRows], [groupToggle], [groupExpand], [groupCollapse]` on `<tbw-grid>` for the matching feature plugin. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[groupingRows], tbw-grid[groupToggle], tbw-grid[groupExpand], tbw-grid[groupCollapse]',
  standalone: true,
})
export class GridGroupingRowsDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly groupingRows = input<GroupingRowsConfig>();
  readonly groupToggle = output<GroupToggleDetail>();
  readonly groupExpand = output<GroupExpandDetail>();
  readonly groupCollapse = output<GroupCollapseDetail>();

  private readonly listeners = new Map<string, (e: Event) => void>();
  private static readonly EVENTS = ['group-toggle', 'group-expand', 'group-collapse'] as const;

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'groupingRows', () => this.groupingRows());
    for (const ev of GridGroupingRowsDirective.EVENTS) claimEvent(grid, ev);
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    const wire = <T>(name: string, out: { emit: (v: T) => void }): void => {
      const l = (e: Event): void => out.emit((e as CustomEvent<T>).detail);
      grid.addEventListener(name, l);
      this.listeners.set(name, l);
    };
    wire<GroupToggleDetail>('group-toggle', this.groupToggle);
    wire<GroupExpandDetail>('group-expand', this.groupExpand);
    wire<GroupCollapseDetail>('group-collapse', this.groupCollapse);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    for (const [name, l] of this.listeners) grid.removeEventListener(name, l);
    this.listeners.clear();
    unregisterFeatureClaim(grid, 'groupingRows');
    for (const ev of GridGroupingRowsDirective.EVENTS) unclaimEvent(grid, ev);
  }
}
