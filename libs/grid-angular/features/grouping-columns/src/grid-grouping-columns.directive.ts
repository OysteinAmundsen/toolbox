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
import type { ColumnGroupDefinition, GroupingColumnsConfig } from '@toolbox-web/grid/plugins/grouping-columns';

/**
 * Angular-shaped column group definition that allows an Angular component
 * class as the per-group `renderer`.
 *
 * @since 1.7.0
 */
export type AngularColumnGroupDefinition = Omit<ColumnGroupDefinition, 'renderer'> & {
  renderer?: ColumnGroupDefinition['renderer'] | Type<unknown>;
};

/**
 * Angular-shaped grouping columns config that allows Angular component classes
 * for `groupHeaderRenderer` and per-group `renderer` inside `columnGroups`.
 *
 * Component instances receive the {@link GroupHeaderRenderParams} fields as
 * inputs (`id`, `label`, `columns`, `firstIndex`, `isImplicit`).
 *
 * @since 1.7.0
 */
export type AngularGroupingColumnsConfig = Omit<GroupingColumnsConfig, 'groupHeaderRenderer' | 'columnGroups'> & {
  columnGroups?: AngularColumnGroupDefinition[];
  groupHeaderRenderer?: GroupingColumnsConfig['groupHeaderRenderer'] | Type<unknown>;
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

  readonly groupingColumns = input<boolean | AngularGroupingColumnsConfig>();

  constructor() {
    registerFeatureClaim(this.elementRef.nativeElement, 'groupingColumns', () => this.groupingColumns());
  }

  ngOnDestroy(): void {
    unregisterFeatureClaim(this.elementRef.nativeElement, 'groupingColumns');
  }
}
