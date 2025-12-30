/**
 * Export Plugin Types
 *
 * Type definitions for the data export feature.
 */

/** Supported export formats */
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
}

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
