/**
 * `GridClipboardDirective` — owns `[clipboard]`, `(copy)`, `(paste)` on
 * `<tbw-grid>`. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { ClipboardConfig, CopyDetail, PasteDetail } from '@toolbox-web/grid/plugins/clipboard';

/**
 * Owns the binding(s) `[clipboard], [copy], [paste]` on `<tbw-grid>` for the matching feature plugin. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[clipboard], tbw-grid[copy], tbw-grid[paste]',
  standalone: true,
})
export class GridClipboardDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly clipboard = input<boolean | ClipboardConfig>();
  readonly copy = output<CopyDetail>();
  readonly paste = output<PasteDetail>();

  private readonly listeners = new Map<string, (e: Event) => void>();

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'clipboard', () => this.clipboard());
    claimEvent(grid, 'copy');
    claimEvent(grid, 'paste');
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    const wire = <T>(name: string, out: { emit: (v: T) => void }): void => {
      const l = (e: Event): void => out.emit((e as CustomEvent<T>).detail);
      grid.addEventListener(name, l);
      this.listeners.set(name, l);
    };
    wire<CopyDetail>('copy', this.copy);
    wire<PasteDetail>('paste', this.paste);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    for (const [name, l] of this.listeners) grid.removeEventListener(name, l);
    this.listeners.clear();
    unregisterFeatureClaim(grid, 'clipboard');
    unclaimEvent(grid, 'copy');
    unclaimEvent(grid, 'paste');
  }
}
