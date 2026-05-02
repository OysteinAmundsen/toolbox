/**
 * `GridUndoRedoDirective` — owns `[undoRedo]`, `(undo)` and `(redo)` on
 * `<tbw-grid>`. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { UndoRedoConfig, UndoRedoDetail } from '@toolbox-web/grid/plugins/undo-redo';

@Directive({
  selector: 'tbw-grid[undoRedo], tbw-grid[undo], tbw-grid[redo]',
  standalone: true,
})
export class GridUndoRedoDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly undoRedo = input<boolean | UndoRedoConfig>();
  readonly undo = output<UndoRedoDetail>();
  readonly redo = output<UndoRedoDetail>();

  private readonly listeners = new Map<string, (e: Event) => void>();

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'undoRedo', () => this.undoRedo());
    claimEvent(grid, 'undo');
    claimEvent(grid, 'redo');
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    const wire = (name: string, out: { emit: (v: UndoRedoDetail) => void }): void => {
      const l = (e: Event): void => out.emit((e as CustomEvent<UndoRedoDetail>).detail);
      grid.addEventListener(name, l);
      this.listeners.set(name, l);
    };
    wire('undo', this.undo);
    wire('redo', this.redo);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    for (const [name, l] of this.listeners) grid.removeEventListener(name, l);
    this.listeners.clear();
    unregisterFeatureClaim(grid, 'undoRedo');
    unclaimEvent(grid, 'undo');
    unclaimEvent(grid, 'redo');
  }
}
