/**
 * `GridSelectionDirective` — owns `[selection]` and `(selectionChange)` on
 * `<tbw-grid>`. See `GridFilteringDirective` for the full rationale and
 * lifecycle contract; the same patterns apply here.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { SelectionChangeDetail, SelectionConfig } from '@toolbox-web/grid/plugins/selection';

/**
 * Owns the binding(s) `[selection], [selectionChange]` on `<tbw-grid>` for the matching feature plugin. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[selection], tbw-grid[selectionChange]',
  standalone: true,
})
export class GridSelectionDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly selection = input<'cell' | 'row' | 'range' | SelectionConfig<any>>();
  readonly selectionChange = output<SelectionChangeDetail>();

  private listener?: (e: Event) => void;

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'selection', () => this.selection());
    claimEvent(grid, 'selection-change');
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    this.listener = (e: Event) => this.selectionChange.emit((e as CustomEvent<SelectionChangeDetail>).detail);
    grid.addEventListener('selection-change', this.listener);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    if (this.listener) {
      grid.removeEventListener('selection-change', this.listener);
      this.listener = undefined;
    }
    unregisterFeatureClaim(grid, 'selection');
    unclaimEvent(grid, 'selection-change');
  }
}
