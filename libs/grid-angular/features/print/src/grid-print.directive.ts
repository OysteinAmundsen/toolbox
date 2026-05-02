/**
 * `GridPrintDirective` — owns `[print]`, `(printStart)` and
 * `(printComplete)` on `<tbw-grid>`. See `GridFilteringDirective` for the
 * full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { PrintCompleteDetail, PrintConfig, PrintStartDetail } from '@toolbox-web/grid/plugins/print';

@Directive({
  selector: 'tbw-grid[print], tbw-grid[printStart], tbw-grid[printComplete]',
  standalone: true,
})
export class GridPrintDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly print = input<boolean | PrintConfig>();
  readonly printStart = output<PrintStartDetail>();
  readonly printComplete = output<PrintCompleteDetail>();

  private readonly listeners = new Map<string, (e: Event) => void>();

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'print', () => this.print());
    claimEvent(grid, 'print-start');
    claimEvent(grid, 'print-complete');
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    const wire = <T>(name: string, out: { emit: (v: T) => void }): void => {
      const l = (e: Event): void => out.emit((e as CustomEvent<T>).detail);
      grid.addEventListener(name, l);
      this.listeners.set(name, l);
    };
    wire<PrintStartDetail>('print-start', this.printStart);
    wire<PrintCompleteDetail>('print-complete', this.printComplete);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    for (const [name, l] of this.listeners) grid.removeEventListener(name, l);
    this.listeners.clear();
    unregisterFeatureClaim(grid, 'print');
    unclaimEvent(grid, 'print-start');
    unclaimEvent(grid, 'print-complete');
  }
}
