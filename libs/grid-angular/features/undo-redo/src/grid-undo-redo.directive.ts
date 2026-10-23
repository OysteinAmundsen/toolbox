/**
 * `GridUndoRedoDirective` — owns `[undoRedo]`, `(undo)`, `(redo)` and
 * `(historyChange)` on `<tbw-grid>`. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { HistoryChangeDetail, UndoRedoConfig, UndoRedoDetail } from '@toolbox-web/grid/plugins/undo-redo';

/**
 * Owns the binding(s) `[undoRedo], [undo], [redo], [historyChange]` on `<tbw-grid>` for the matching feature plugin. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[undoRedo], tbw-grid[undo], tbw-grid[redo], tbw-grid[historyChange]',
  standalone: true,
})
export class GridUndoRedoDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly undoRedo = input<boolean | UndoRedoConfig>();
  readonly undo = output<UndoRedoDetail>();
  readonly redo = output<UndoRedoDetail>();
  /**
   * Fired whenever the undo/redo history changes (edit recorded, undo, redo, history cleared).
   * @since 2.6.3
   */
  readonly historyChange = output<HistoryChangeDetail>();

  private readonly listeners = new Map<string, (e: Event) => void>();

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'undoRedo', () => this.undoRedo());
    claimEvent(grid, 'undo');
    claimEvent(grid, 'redo');
    claimEvent(grid, 'history-change');
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    const wire = <T>(name: string, out: { emit: (v: T) => void }): void => {
      const l = (e: Event): void => out.emit((e as CustomEvent<T>).detail);
      grid.addEventListener(name, l);
      this.listeners.set(name, l);
    };
    wire<UndoRedoDetail>('undo', this.undo);
    wire<UndoRedoDetail>('redo', this.redo);
    wire<HistoryChangeDetail>('history-change', this.historyChange);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    for (const [name, l] of this.listeners) grid.removeEventListener(name, l);
    this.listeners.clear();
    unregisterFeatureClaim(grid, 'undoRedo');
    unclaimEvent(grid, 'undo');
    unclaimEvent(grid, 'redo');
    unclaimEvent(grid, 'history-change');
  }
}
