/**
 * Export Plugin Types
 *
 * Type definitions for the data export feature.
 */

/**
 * Supported export file formats.
 *
 * | Format   | Output | Notes |
 * |----------|--------|-------|
 * | `'csv'`  | Comma-separated values (`.csv`) | Plain text, universally supported. Large datasets export fast. |
 * | `'excel'`| Excel workbook (`.xlsx`) | Preserves column types and headers. Requires a serializer that can produce OOXML. |
 * | `'json'` | JSON array (`.json`) | Exports row objects as-is; useful for programmatic consumption or re-import. |
 */
export type ExportFormat = 'csv' | 'excel' | 'json';

/** Configuration options for the export plugin */
export interface ExportConfig {
  /** Default file name for exports (default: 'export') */
  fileName?: string;
  /** Include column headers in export (default: true) */
  includeHeaders?: boolean;
  /** Export only visible columns (default: true) */
  onlyVisible?: boolean;
  /** Export only selected rows (default: false) */
  onlySelected?: boolean;
}

/** Parameters for a specific export operation */
export interface ExportParams {
  /** Export format */
  format: ExportFormat;
  /** File name for the export (without extension) */
  fileName?: string;
  /**
   * Override the file extension for Excel export.
   *
   * Defaults to `'.xls'` so the file opens in Excel on most operating systems.
   * Set to `'.xml'` to avoid Excel's "format mismatch" warning — but note
   * that `.xml` files open in a browser by default on most systems.
   *
   * Only applies to Excel format exports.
   */
  fileExtension?: string;
  /** Specific column fields to export */
  columns?: string[];
  /** Specific row indices to export */
  rowIndices?: number[];
  /** Include column headers in export */
  includeHeaders?: boolean;
  /** Custom cell value processor */
  processCell?: (value: any, field: string, row: any) => any;
  /** Custom header processor */
  processHeader?: (header: string, field: string) => string;
  /** Excel style configuration (only applies to Excel export) */
  excelStyles?: ExcelStyleConfig;
}

// #region Excel Style Types

/**
 * Configuration for styled Excel export.
 *
 * Controls header styles, per-column and per-cell formatting,
 * column widths, and auto-fit behavior in Excel XML output.
 */
export interface ExcelStyleConfig {
  /** Style applied to all header cells */
  headerStyle?: ExcelCellStyle;
  /** Default style for all data cells */
  defaultStyle?: ExcelCellStyle;
  /** Per-column style overrides (keyed by field name) */
  columnStyles?: Record<string, ExcelCellStyle>;
  /** Callback for per-cell dynamic styling */
  cellStyle?: (value: unknown, field: string, row: unknown) => ExcelCellStyle | undefined;
  /** Column width overrides in characters (keyed by field name) */
  columnWidths?: Record<string, number>;
  /** Auto-fit column widths based on content (default: false) */
  autoFitColumns?: boolean;
}

/** Style definition for an Excel cell. */
export interface ExcelCellStyle {
  /** Font configuration */
  font?: {
    name?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    color?: string;
  };
  /** Fill / background color */
  fill?: {
    color: string;
    pattern?: 'Solid' | 'None';
  };
  /** Number format string (Excel format codes) */
  numberFormat?: string;
  /** Text alignment */
  alignment?: {
    horizontal?: 'Left' | 'Center' | 'Right';
    vertical?: 'Top' | 'Center' | 'Bottom';
    wrapText?: boolean;
  };
  /** Cell borders */
  borders?: {
    top?: ExcelBorder;
    bottom?: ExcelBorder;
    left?: ExcelBorder;
    right?: ExcelBorder;
  };
}

/** Border definition for an Excel cell edge. */
export interface ExcelBorder {
  style: 'Thin' | 'Medium' | 'Thick';
  color?: string;
}

// #endregion

/** Internal state managed by the export plugin */
export interface ExportState {
  /** Whether an export is currently in progress */
  isExporting: boolean;
  /** Information about the last export */
  lastExport: { format: ExportFormat; timestamp: Date } | null;
}

/** Event detail emitted when export completes */
export interface ExportCompleteDetail {
  /** Format of the export */
  format: ExportFormat;
  /** File name of the export */
  fileName: string;
  /** Number of rows exported */
  rowCount: number;
  /** Number of columns exported */
  columnCount: number;
}

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface DataGridEventMap {
    /** Fired when an export operation completes. Provides the format, filename, and row/column counts. @group Export Events */
    'export-complete': ExportCompleteDetail;
  }

  interface PluginNameMap {
    export: import('./ExportPlugin').ExportPlugin;
  }
}
