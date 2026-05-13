/**
 * `GridContextMenuDirective` — owns `[contextMenu]` and `(contextMenuOpen)`
 * on `<tbw-grid>`. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { ContextMenuConfig, ContextMenuOpenDetail } from '@toolbox-web/grid/plugins/context-menu';

/**
 * Owns the binding(s) `[contextMenu], [contextMenuOpen]` on `<tbw-grid>` for the matching feature plugin. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[contextMenu], tbw-grid[contextMenuOpen]',
  standalone: true,
})
export class GridContextMenuDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly contextMenu = input<boolean | ContextMenuConfig>();
  readonly contextMenuOpen = output<ContextMenuOpenDetail>();

  private listener?: (e: Event) => void;

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'contextMenu', () => this.contextMenu());
    claimEvent(grid, 'context-menu-open');
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    this.listener = (e: Event): void => this.contextMenuOpen.emit((e as CustomEvent<ContextMenuOpenDetail>).detail);
    grid.addEventListener('context-menu-open', this.listener);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    if (this.listener) {
      grid.removeEventListener('context-menu-open', this.listener);
      this.listener = undefined;
    }
    unregisterFeatureClaim(grid, 'contextMenu');
    unclaimEvent(grid, 'context-menu-open');
  }
}
