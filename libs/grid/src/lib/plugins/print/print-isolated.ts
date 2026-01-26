/**
 * Utility for printing a grid in isolation by hiding all other page content.
 *
 * This approach keeps the grid in place (with virtualization disabled by PrintPlugin)
 * and uses CSS to hide everything else on the page during printing.
 */

import type { PrintOrientation } from './types';

export interface PrintIsolatedOptions {
  /** Page orientation hint */
  orientation?: PrintOrientation;
}

/** ID for the isolation stylesheet */
const ISOLATION_STYLE_ID = 'tbw-print-isolation-style';

/**
 * Create a stylesheet that hides everything except the target grid.
 * Uses the grid's ID to target it specifically.
 */
function createIsolationStylesheet(gridId: string, orientation: PrintOrientation): HTMLStyleElement {
  const style = document.createElement('style');
  style.id = ISOLATION_STYLE_ID;
  style.textContent = `
    /* Print isolation: hide everything except the target grid */
    @media print {
      /* Hide all body children by default */
      body > *:not(#${gridId}) {
        display: none !important;
      }

      /* But show the grid and ensure it's not hidden by ancestor rules */
      #${gridId} {
        display: block !important;
        position: static !important;
        visibility: visible !important;
        opacity: 1 !important;
        overflow: visible !important;
        height: auto !important;
        width: 100% !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 0 !important;
        transform: none !important;
      }

      /* If grid is nested, we need to show its ancestors too */
      #${gridId},
      #${gridId} * {
        visibility: visible !important;
      }

      /* Walk up the DOM and show all ancestors of the grid */
      body *:has(> #${gridId}),
      body *:has(#${gridId}) {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        overflow: visible !important;
        height: auto !important;
        position: static !important;
        transform: none !important;
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      /* Hide siblings of ancestors (everything that's not in the path to the grid) */
      body *:has(#${gridId}) > *:not(:has(#${gridId})):not(#${gridId}) {
        display: none !important;
      }

      /* Page settings */
      @page {
        size: ${orientation};
        margin: 1cm;
      }

      /* Ensure proper print styling */
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        color-scheme: light !important;
      }
    }

    /* Screen: also apply isolation for print preview */
    @media screen {
      /* When this stylesheet is active, we're about to print */
      /* No screen-specific rules needed - isolation only applies to print */
    }
  `;
  return style;
}

/**
 * Print a grid in isolation by hiding all other page content.
 *
 * This function adds a temporary stylesheet that uses CSS to hide everything
 * on the page except the target grid during printing. The grid stays in place
 * with all its data (virtualization should be disabled separately).
 *
 * @param gridElement - The tbw-grid element to print (must have an ID)
 * @param options - Optional configuration
 * @returns Promise that resolves when the print dialog closes
 *
 * @example
 * ```typescript
 * import { printGridIsolated } from '@toolbox-web/grid/plugins/print';
 *
 * const grid = document.querySelector('tbw-grid');
 * await printGridIsolated(grid, { orientation: 'landscape' });
 * ```
 */
export async function printGridIsolated(gridElement: HTMLElement, options: PrintIsolatedOptions = {}): Promise<void> {
  const { orientation = 'landscape' } = options;

  const gridId = gridElement.id;

  // Warn if multiple elements share this ID (user-set IDs could collide)
  const elementsWithId = document.querySelectorAll(`#${CSS.escape(gridId)}`);
  if (elementsWithId.length > 1) {
    console.warn(
      `[tbw-grid:print] Multiple elements found with id="${gridId}". ` +
        `Print isolation may not work correctly. Ensure each grid has a unique ID.`,
    );
  }

  // Remove any existing isolation stylesheet
  document.getElementById(ISOLATION_STYLE_ID)?.remove();

  // Add the isolation stylesheet
  const isolationStyle = createIsolationStylesheet(gridId, orientation);
  document.head.appendChild(isolationStyle);

  return new Promise((resolve) => {
    // Listen for afterprint event to cleanup
    const onAfterPrint = () => {
      window.removeEventListener('afterprint', onAfterPrint);
      // Remove isolation stylesheet
      document.getElementById(ISOLATION_STYLE_ID)?.remove();
      resolve();
    };
    window.addEventListener('afterprint', onAfterPrint);

    // Trigger print
    window.print();

    // Fallback timeout in case afterprint doesn't fire (some browsers)
    setTimeout(() => {
      window.removeEventListener('afterprint', onAfterPrint);
      document.getElementById(ISOLATION_STYLE_ID)?.remove();
      resolve();
    }, 5000);
  });
}
