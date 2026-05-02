/**
 * `GridEditingDirective` — owns `[editing]` and the editing-specific
 * outputs on `<tbw-grid>`. The shared outputs `cellChange` and `dataChange`
 * stay on `Grid` because they are emitted by multiple sources, not just
 * the editing plugin. See `GridFilteringDirective` for full rationale.
 *
 * Output type compatibility note: this directive uses the Angular adapter
 * wrapper types `CellCommitEvent` / `RowCommitEvent` (re-exported from the
 * package barrel) to stay binary-compatible with apps migrating from the
 * deprecated bindings on `Grid`.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import {
  type CellCommitEvent,
  claimEvent,
  registerFeatureClaim,
  type RowCommitEvent,
  unclaimEvent,
  unregisterFeatureClaim,
} from '@toolbox-web/grid-angular';
import type {
  BeforeEditCloseDetail,
  CellCancelDetail,
  ChangedRowsResetDetail,
  DirtyChangeDetail,
  EditCloseDetail,
  EditingConfig,
  EditOpenDetail,
} from '@toolbox-web/grid/plugins/editing';

@Directive({
  selector:
    'tbw-grid[editing], tbw-grid[cellCommit], tbw-grid[cellCancel], tbw-grid[rowCommit], tbw-grid[changedRowsReset], tbw-grid[editOpen], tbw-grid[beforeEditClose], tbw-grid[editClose], tbw-grid[dirtyChange]',
  standalone: true,
})
export class GridEditingDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly editing = input<boolean | 'click' | 'dblclick' | 'manual' | EditingConfig>();
  readonly cellCommit = output<CellCommitEvent>();
  readonly cellCancel = output<CellCancelDetail>();
  readonly rowCommit = output<RowCommitEvent>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly changedRowsReset = output<ChangedRowsResetDetail<any>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly editOpen = output<EditOpenDetail<any>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly beforeEditClose = output<BeforeEditCloseDetail<any>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly editClose = output<EditCloseDetail<any>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly dirtyChange = output<DirtyChangeDetail<any>>();

  private readonly listeners = new Map<string, (e: Event) => void>();
  private static readonly EVENTS = [
    'cell-commit',
    'cell-cancel',
    'row-commit',
    'changed-rows-reset',
    'edit-open',
    'before-edit-close',
    'edit-close',
    'dirty-change',
  ] as const;

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'editing', () => this.editing());
    for (const ev of GridEditingDirective.EVENTS) claimEvent(grid, ev);
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    const wire = <T>(name: string, out: { emit: (v: T) => void }): void => {
      const l = (e: Event): void => out.emit((e as CustomEvent<T>).detail);
      grid.addEventListener(name, l);
      this.listeners.set(name, l);
    };
    wire<CellCommitEvent>('cell-commit', this.cellCommit);
    wire<CellCancelDetail>('cell-cancel', this.cellCancel);
    wire<RowCommitEvent>('row-commit', this.rowCommit);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wire<ChangedRowsResetDetail<any>>('changed-rows-reset', this.changedRowsReset);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wire<EditOpenDetail<any>>('edit-open', this.editOpen);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wire<BeforeEditCloseDetail<any>>('before-edit-close', this.beforeEditClose);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wire<EditCloseDetail<any>>('edit-close', this.editClose);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wire<DirtyChangeDetail<any>>('dirty-change', this.dirtyChange);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    for (const [name, l] of this.listeners) grid.removeEventListener(name, l);
    this.listeners.clear();
    unregisterFeatureClaim(grid, 'editing');
    for (const ev of GridEditingDirective.EVENTS) unclaimEvent(grid, ev);
  }
}
