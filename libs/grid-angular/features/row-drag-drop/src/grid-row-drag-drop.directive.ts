/**
 * `GridRowDragDropDirective` — owns `[rowDragDrop]` and the row drag-drop
 * outputs on `<tbw-grid>`. See `GridFilteringDirective` for the full
 * rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type {
  RowDragDropConfig,
  RowDragEndDetail,
  RowDragStartDetail,
  RowDropDetail,
  RowMoveDetail,
  RowTransferDetail,
} from '@toolbox-web/grid/plugins/row-drag-drop';

@Directive({
  selector:
    'tbw-grid[rowDragDrop], tbw-grid[rowMove], tbw-grid[rowDragStart], tbw-grid[rowDragEnd], tbw-grid[rowDrop], tbw-grid[rowTransfer]',
  standalone: true,
})
export class GridRowDragDropDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly rowDragDrop = input<boolean | RowDragDropConfig<any>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly rowMove = output<RowMoveDetail<any>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly rowDragStart = output<RowDragStartDetail<any>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly rowDragEnd = output<RowDragEndDetail<any>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly rowDrop = output<RowDropDetail<any>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly rowTransfer = output<RowTransferDetail<any>>();

  private readonly listeners = new Map<string, (e: Event) => void>();
  private static readonly EVENTS = ['row-move', 'row-drag-start', 'row-drag-end', 'row-drop', 'row-transfer'] as const;

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'rowDragDrop', () => this.rowDragDrop());
    for (const ev of GridRowDragDropDirective.EVENTS) claimEvent(grid, ev);
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    const wire = <T>(name: string, out: { emit: (v: T) => void }): void => {
      const l = (e: Event): void => out.emit((e as CustomEvent<T>).detail);
      grid.addEventListener(name, l);
      this.listeners.set(name, l);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wire<RowMoveDetail<any>>('row-move', this.rowMove);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wire<RowDragStartDetail<any>>('row-drag-start', this.rowDragStart);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wire<RowDragEndDetail<any>>('row-drag-end', this.rowDragEnd);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wire<RowDropDetail<any>>('row-drop', this.rowDrop);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wire<RowTransferDetail<any>>('row-transfer', this.rowTransfer);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    for (const [name, l] of this.listeners) grid.removeEventListener(name, l);
    this.listeners.clear();
    unregisterFeatureClaim(grid, 'rowDragDrop');
    for (const ev of GridRowDragDropDirective.EVENTS) unclaimEvent(grid, ev);
  }
}
