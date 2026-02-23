/**
 * Print feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `print` input on Grid directive.
 * Also exports `injectGridPrint()` for programmatic print control.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/print';
 *
 * <tbw-grid [print]="true" />
 * ```
 *
 * @example Using injectGridPrint
 * ```typescript
 * import { injectGridPrint } from '@toolbox-web/grid-angular/features/print';
 *
 * @Component({...})
 * export class MyComponent {
 *   private gridPrint = injectGridPrint();
 *
 *   printReport() {
 *     this.gridPrint.print({ title: 'My Report' });
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { afterNextRender, DestroyRef, ElementRef, inject, signal, type Signal } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeature } from '@toolbox-web/grid-angular';
import { PrintPlugin, type PrintParams } from '@toolbox-web/grid/plugins/print';

registerFeature('print', (config) => {
  if (config === true) {
    return new PrintPlugin();
  }
  return new PrintPlugin(config ?? undefined);
});

/**
 * Print methods returned from injectGridPrint.
 *
 * Uses lazy discovery - the grid is found on first method call, not during initialization.
 */
export interface PrintMethods {
  /**
   * Print the grid.
   * Opens browser print dialog after preparing the grid for printing.
   * @param params - Optional print parameters
   */
  print: (params?: PrintParams) => Promise<void>;

  /**
   * Check if a print operation is currently in progress.
   */
  isPrinting: () => boolean;

  /**
   * Signal indicating if grid is ready.
   */
  isReady: Signal<boolean>;
}

/**
 * Angular inject function for programmatic print control.
 *
 * Uses **lazy grid discovery** - the grid element is found when methods are called,
 * not during initialization.
 *
 * @example
 * ```typescript
 * import { Component } from '@angular/core';
 * import { Grid } from '@toolbox-web/grid-angular';
 * import '@toolbox-web/grid-angular/features/print';
 * import { injectGridPrint } from '@toolbox-web/grid-angular/features/print';
 *
 * @Component({
 *   selector: 'app-my-grid',
 *   imports: [Grid],
 *   template: `
 *     <button (click)="handlePrint()" [disabled]="gridPrint.isPrinting()">
 *       {{ gridPrint.isPrinting() ? 'Printing...' : 'Print' }}
 *     </button>
 *     <tbw-grid [rows]="rows" [print]="true"></tbw-grid>
 *   `
 * })
 * export class MyGridComponent {
 *   gridPrint = injectGridPrint();
 *
 *   async handlePrint() {
 *     await this.gridPrint.print({ title: 'Employee Report', isolate: true });
 *     console.log('Print dialog closed');
 *   }
 * }
 * ```
 */
export function injectGridPrint(): PrintMethods {
  const elementRef = inject(ElementRef);
  const destroyRef = inject(DestroyRef);
  const isReady = signal(false);

  let cachedGrid: DataGridElement | null = null;
  let readyPromiseStarted = false;

  const getGrid = (): DataGridElement | null => {
    if (cachedGrid) return cachedGrid;

    const grid = elementRef.nativeElement.querySelector('tbw-grid') as DataGridElement | null;
    if (grid) {
      cachedGrid = grid;
      if (!readyPromiseStarted) {
        readyPromiseStarted = true;
        grid.ready?.().then(() => isReady.set(true));
      }
    }
    return grid;
  };

  const getPlugin = (): PrintPlugin | undefined => {
    return getGrid()?.getPlugin(PrintPlugin);
  };

  // Eagerly discover the grid after the first render so isReady updates
  // without requiring a programmatic method call. Falls back to a
  // MutationObserver for lazy-rendered tabs, *ngIf, @defer, etc.
  afterNextRender(() => {
    if (getGrid()) return;

    const host = elementRef.nativeElement as HTMLElement;
    const observer = new MutationObserver(() => {
      if (getGrid()) observer.disconnect();
    });
    observer.observe(host, { childList: true, subtree: true });

    destroyRef.onDestroy(() => observer.disconnect());
  });

  return {
    isReady: isReady.asReadonly(),

    print: async (params?: PrintParams) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:print] PrintPlugin not found.\n\n` +
            `  → Enable print on the grid:\n` +
            `    <tbw-grid [print]="true" />`,
        );
        return;
      }
      await plugin.print(params);
    },

    isPrinting: () => getPlugin()?.isPrinting() ?? false,
  };
}
