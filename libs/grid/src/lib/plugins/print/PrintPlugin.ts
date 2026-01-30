/**
 * Print Plugin (Class-based)
 *
 * Provides print layout functionality for tbw-grid.
 * Temporarily disables virtualization to render all rows and uses
 * @media print CSS for print-optimized styling.
 */

import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { InternalGrid, ToolbarContentDefinition } from '../../core/types';
import { printGridIsolated } from './print-isolated';
import styles from './print.css?inline';
import type { PrintCompleteDetail, PrintConfig, PrintParams, PrintStartDetail } from './types';

/**
 * Extended grid interface for PrintPlugin internal access.
 * Includes registerToolbarContent which is available on the grid class
 * but not exposed in the standard plugin API.
 */
interface PrintGridRef extends InternalGrid {
  registerToolbarContent?(content: ToolbarContentDefinition): void;
  unregisterToolbarContent?(contentId: string): void;
}

/** Default configuration */
const DEFAULT_CONFIG: Required<PrintConfig> = {
  button: false,
  orientation: 'landscape',
  warnThreshold: 500,
  maxRows: 0,
  includeTitle: true,
  includeTimestamp: true,
  title: '',
  isolate: false,
};

/**
 * Print Plugin for tbw-grid
 *
 * Enables printing the full grid content by temporarily disabling virtualization
 * and applying print-optimized styles. Handles large datasets gracefully with
 * configurable row limits.
 *
 * ## Installation
 *
 * ```ts
 * import { PrintPlugin } from '@toolbox-web/grid/plugins/print';
 * ```
 *
 * ## Configuration Options
 *
 * | Option | Type | Default | Description |
 * |--------|------|---------|-------------|
 * | `button` | `boolean` | `false` | Show print button in toolbar |
 * | `orientation` | `'portrait' \| 'landscape'` | `'landscape'` | Page orientation |
 * | `warnThreshold` | `number` | `500` | Show confirmation dialog when rows exceed this (0 = no warning) |
 * | `maxRows` | `number` | `0` | Hard limit on printed rows (0 = unlimited) |
 * | `includeTitle` | `boolean` | `true` | Include grid title in print |
 * | `includeTimestamp` | `boolean` | `true` | Include timestamp in footer |
 * | `title` | `string` | `''` | Custom print title |
 *
 * ## Programmatic API
 *
 * | Method | Signature | Description |
 * |--------|-----------|-------------|
 * | `print` | `(params?) => Promise<void>` | Trigger print dialog |
 * | `isPrinting` | `() => boolean` | Check if print is in progress |
 *
 * ## Events
 *
 * | Event | Detail | Description |
 * |-------|--------|-------------|
 * | `print-start` | `PrintStartDetail` | Fired when print begins |
 * | `print-complete` | `PrintCompleteDetail` | Fired when print completes |
 *
 * @example Basic Print
 * ```ts
 * import { PrintPlugin } from '@toolbox-web/grid/plugins/print';
 *
 * const grid = document.querySelector('tbw-grid');
 * grid.gridConfig = {
 *   plugins: [new PrintPlugin()],
 * };
 *
 * // Trigger print
 * const printPlugin = grid.getPlugin(PrintPlugin);
 * await printPlugin.print();
 * ```
 *
 * @example With Toolbar Button
 * ```ts
 * grid.gridConfig = {
 *   plugins: [new PrintPlugin({ button: true, orientation: 'landscape' })],
 * };
 * ```
 *
 * @see {@link PrintConfig} for all configuration options
 */
export class PrintPlugin extends BaseGridPlugin<PrintConfig> {
  /** @internal */
  readonly name = 'print';

  /** @internal */
  override readonly version = '1.0.0';

  /** CSS styles for print mode */
  override readonly styles = styles;

  /** Current print state */
  #printing = false;

  /** Saved column visibility state */
  #savedHiddenColumns: Map<string, boolean> | null = null;

  /** Saved virtualization state */
  #savedVirtualization: { bypassThreshold: number } | null = null;

  /** Saved rows when maxRows limit is applied */
  #savedRows: unknown[] | null = null;

  /** Print header element */
  #printHeader: HTMLElement | null = null;

  /** Print footer element */
  #printFooter: HTMLElement | null = null;

  /** Applied scale factor (legacy, used for cleanup) */
  #appliedScale: number | null = null;

  /**
   * Get the grid typed as PrintGridRef for internal access.
   */
  get #internalGrid(): PrintGridRef {
    return this.grid as unknown as PrintGridRef;
  }

  /**
   * Check if print is currently in progress
   */
  isPrinting(): boolean {
    return this.#printing;
  }

  /**
   * Trigger the browser print dialog
   *
   * This method:
   * 1. Validates row count against maxRows limit
   * 2. Disables virtualization to render all rows
   * 3. Applies print-specific CSS classes
   * 4. Opens the browser print dialog (or isolated window if `isolate: true`)
   * 5. Restores normal state after printing
   *
   * @param params - Optional parameters to override config for this print
   * @param params.isolate - If true, prints in an isolated window containing only the grid
   * @returns Promise that resolves when print dialog closes
   */
  async print(params?: PrintParams): Promise<void> {
    if (this.#printing) {
      console.warn('[PrintPlugin] Print already in progress');
      return;
    }

    const grid = this.gridElement;
    if (!grid) {
      console.warn('[PrintPlugin] Grid not available');
      return;
    }

    const config = { ...DEFAULT_CONFIG, ...this.config, ...params };
    const rows = this.rows;
    const originalRowCount = rows.length;
    let rowCount = originalRowCount;
    let limitApplied = false;

    // Check if we should warn about large datasets
    if (config.warnThreshold > 0 && originalRowCount > config.warnThreshold) {
      const limitInfo =
        config.maxRows > 0 ? `\n\nNote: Output will be limited to ${config.maxRows.toLocaleString()} rows.` : '';
      const proceed = confirm(
        `This grid has ${originalRowCount.toLocaleString()} rows. ` +
          `Printing large datasets may cause performance issues or browser slowdowns.${limitInfo}\n\n` +
          `Click OK to continue, or Cancel to abort.`,
      );
      if (!proceed) {
        return;
      }
    }

    // Apply hard row limit if configured
    if (config.maxRows > 0 && originalRowCount > config.maxRows) {
      rowCount = config.maxRows;
      limitApplied = true;
    }

    this.#printing = true;

    // Track timing for duration reporting
    const startTime = performance.now();

    // Emit print-start event
    this.emit<PrintStartDetail>('print-start', {
      rowCount,
      limitApplied,
      originalRowCount,
    });

    try {
      // Save current virtualization state
      const internalGrid = this.#internalGrid;
      this.#savedVirtualization = {
        bypassThreshold: internalGrid._virtualization?.bypassThreshold ?? 24,
      };

      // Hide columns marked with printHidden
      this.#hidePrintColumns();

      // Apply row limit if configured
      if (limitApplied) {
        this.#savedRows = this.sourceRows;
        // Set limited rows on the grid
        (this.grid as unknown as { rows: unknown[] }).rows = this.sourceRows.slice(0, rowCount);
        // Wait for grid to process new rows
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Add print header if configured
      if (config.includeTitle || config.includeTimestamp) {
        this.#addPrintHeader(config);
      }

      // Disable virtualization to render all rows
      // This forces the grid to render all rows in the DOM
      await this.#disableVirtualization();

      // Wait for next frame to ensure DOM is updated
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Add orientation class for @page rules
      grid.classList.add(`print-${config.orientation}`);

      // Wait for next frame to ensure DOM is updated
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Trigger browser print dialog (isolated or inline)
      if (config.isolate) {
        await this.#printInIsolatedWindow(config);
      } else {
        await this.#triggerPrint();
      }

      // Emit print-complete event
      this.emit<PrintCompleteDetail>('print-complete', {
        success: true,
        rowCount,
        duration: Math.round(performance.now() - startTime),
      });
    } catch (error) {
      console.error('[PrintPlugin] Print failed:', error);
      this.emit<PrintCompleteDetail>('print-complete', {
        success: false,
        rowCount: 0,
        duration: Math.round(performance.now() - startTime),
      });
    } finally {
      // Restore normal state
      this.#cleanup();
      this.#printing = false;
    }
  }

  /**
   * Add print header with title and timestamp
   */
  #addPrintHeader(config: Required<PrintConfig>): void {
    const grid = this.gridElement;
    if (!grid) return;

    // Create print header
    this.#printHeader = document.createElement('div');
    this.#printHeader.className = 'tbw-print-header';

    // Title
    if (config.includeTitle) {
      const title = config.title || this.grid.effectiveConfig?.shell?.header?.title || 'Grid Data';
      const titleEl = document.createElement('div');
      titleEl.className = 'tbw-print-header-title';
      titleEl.textContent = title;
      this.#printHeader.appendChild(titleEl);
    }

    // Timestamp
    if (config.includeTimestamp) {
      const timestampEl = document.createElement('div');
      timestampEl.className = 'tbw-print-header-timestamp';
      timestampEl.textContent = `Printed: ${new Date().toLocaleString()}`;
      this.#printHeader.appendChild(timestampEl);
    }

    // Insert at the beginning of the grid
    grid.insertBefore(this.#printHeader, grid.firstChild);

    // Create print footer
    this.#printFooter = document.createElement('div');
    this.#printFooter.className = 'tbw-print-footer';
    this.#printFooter.textContent = `Page generated from ${window.location.hostname}`;
    grid.appendChild(this.#printFooter);
  }

  /**
   * Disable virtualization to render all rows
   */
  async #disableVirtualization(): Promise<void> {
    const internalGrid = this.#internalGrid;
    if (!internalGrid._virtualization) return;

    // Set bypass threshold higher than total row count to disable virtualization
    // This makes the grid render all rows (up to maxRows) instead of just visible ones
    const totalRows = this.rows.length;
    internalGrid._virtualization.bypassThreshold = totalRows + 100;

    // Force a full refresh to re-render with virtualization disabled
    internalGrid.refreshVirtualWindow(true);

    // Wait for render to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Trigger the browser print dialog
   */
  async #triggerPrint(): Promise<void> {
    return new Promise((resolve) => {
      // Listen for afterprint event
      const onAfterPrint = () => {
        window.removeEventListener('afterprint', onAfterPrint);
        resolve();
      };
      window.addEventListener('afterprint', onAfterPrint);

      // Trigger print
      window.print();

      // Fallback timeout in case afterprint doesn't fire (some browsers)
      setTimeout(() => {
        // Guard against test environment teardown where window may be undefined
        if (typeof window !== 'undefined') {
          window.removeEventListener('afterprint', onAfterPrint);
        }
        resolve();
      }, 1000);
    });
  }

  /**
   * Print in isolation by hiding all other page content.
   * This excludes navigation, sidebars, etc. while keeping the grid in place.
   */
  async #printInIsolatedWindow(config: Required<PrintConfig>): Promise<void> {
    const grid = this.gridElement;
    if (!grid) return;

    await printGridIsolated(grid, {
      orientation: config.orientation,
    });
  }

  /**
   * Hide columns marked with printHidden: true
   */
  #hidePrintColumns(): void {
    const columns = this.columns;
    if (!columns) return;

    // Save current hidden state and hide print columns
    this.#savedHiddenColumns = new Map();

    for (const col of columns) {
      if (col.printHidden && col.field) {
        // Save current visibility state (true = visible, false = hidden)
        this.#savedHiddenColumns.set(col.field, !col.hidden);
        // Hide the column for printing
        this.grid.setColumnVisible(col.field, false);
      }
    }
  }

  /**
   * Restore columns that were hidden for printing
   */
  #restorePrintColumns(): void {
    if (!this.#savedHiddenColumns) return;

    for (const [field, wasVisible] of this.#savedHiddenColumns) {
      // Restore original visibility
      this.grid.setColumnVisible(field, wasVisible);
    }

    this.#savedHiddenColumns = null;
  }

  /**
   * Cleanup after printing
   */
  #cleanup(): void {
    const grid = this.gridElement;
    if (!grid) return;

    // Restore columns that were hidden for printing
    this.#restorePrintColumns();

    // Remove orientation classes (both original and possibly switched)
    grid.classList.remove('print-portrait', 'print-landscape');

    // Remove scaling transform if applied (legacy)
    if (this.#appliedScale !== null) {
      grid.style.transform = '';
      grid.style.transformOrigin = '';
      grid.style.width = '';
      this.#appliedScale = null;
    }

    // Remove print header/footer
    if (this.#printHeader) {
      this.#printHeader.remove();
      this.#printHeader = null;
    }
    if (this.#printFooter) {
      this.#printFooter.remove();
      this.#printFooter = null;
    }

    // Restore virtualization
    const internalGrid = this.#internalGrid;
    if (this.#savedVirtualization && internalGrid._virtualization) {
      internalGrid._virtualization.bypassThreshold = this.#savedVirtualization.bypassThreshold;
      internalGrid.refreshVirtualWindow(true);
      this.#savedVirtualization = null;
    }

    // Restore original rows if they were limited
    if (this.#savedRows !== null) {
      (this.grid as unknown as { rows: unknown[] }).rows = this.#savedRows;
      this.#savedRows = null;
    }
  }

  /**
   * Register toolbar button if configured
   * @internal
   */
  override afterRender(): void {
    // Register toolbar on first render when button is enabled
    if (this.config?.button && !this.#toolbarRegistered) {
      this.#registerToolbarButton();
      this.#toolbarRegistered = true;
    }
  }

  /** Track if toolbar button is registered */
  #toolbarRegistered = false;

  /**
   * Register print button in toolbar
   */
  #registerToolbarButton(): void {
    const grid = this.#internalGrid;

    // Register toolbar content
    grid.registerToolbarContent?.({
      id: 'print-button',
      order: 900, // High order to appear at the end
      render: (container: HTMLElement) => {
        const button = document.createElement('button');
        button.className = 'tbw-toolbar-btn tbw-print-btn';
        button.title = 'Print grid';
        button.type = 'button';

        // Use print icon
        const icon = this.resolveIcon('print') || '🖨️';
        this.setIcon(button, icon);

        button.addEventListener(
          'click',
          () => {
            this.print();
          },
          { signal: this.disconnectSignal },
        );

        container.appendChild(button);
      },
    });
  }
}
