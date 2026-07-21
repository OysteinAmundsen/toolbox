/**
 * `GridGroupingColumnsDirective` — owns `[groupingColumns]` on
 * `<tbw-grid>`. No event outputs. See `GridFilteringDirective` for the
 * full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, type Type } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeatureClaim, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type {
  ColumnGroupDefinition as CoreColumnGroupDefinition,
  GroupingColumnsConfig as CoreGroupingColumnsConfig,
  GroupHeaderRenderParams,
} from '@toolbox-web/grid/plugins/grouping-columns';

/**
 * Column group definition widened to accept an Angular component class as
 * the per-group `renderer`.
 *
 * @since 1.7.0
 */
export type ColumnGroupDefinition = Omit<CoreColumnGroupDefinition, 'renderer'> & {
  renderer?: CoreColumnGroupDefinition['renderer'] | Type<unknown>;
};

/**
 * Grouping-columns config widened to accept Angular component classes for
 * `groupHeaderRenderer` and per-group `renderer` inside `columnGroups`.
 *
 * Component instances receive the {@link GroupHeaderRenderParams} fields as
 * inputs (`id`, `label`, `columns`, `firstIndex`, `isImplicit`).
 *
 * @since 1.7.0
 */
export type GroupingColumnsConfig = Omit<CoreGroupingColumnsConfig, 'groupHeaderRenderer' | 'columnGroups'> & {
  columnGroups?: ColumnGroupDefinition[];
  groupHeaderRenderer?: CoreGroupingColumnsConfig['groupHeaderRenderer'] | Type<unknown>;
};

/**
 * Owns the binding(s) `[groupingColumns]` on `<tbw-grid>` for the matching feature plugin. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[groupingColumns]',
  standalone: true,
})
export class GridGroupingColumnsDirective implements OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly groupingColumns = input<boolean | GroupingColumnsConfig>();

  constructor() {
    registerFeatureClaim(this.elementRef.nativeElement, 'groupingColumns', () => this.groupingColumns());
  }

  ngOnDestroy(): void {
    unregisterFeatureClaim(this.elementRef.nativeElement, 'groupingColumns');
  }
}
