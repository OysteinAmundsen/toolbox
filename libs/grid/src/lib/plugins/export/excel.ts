/**
 * Excel Export Utilities
 *
 * Simple Excel XML format export (no external dependencies).
 * Produces XML Spreadsheet 2003 format which opens in Excel.
 */

import { resolveCellValue } from '../../core/internal/value-accessor';
import type { ColumnConfig } from '../../core/types';
import { downloadBlob } from './csv';
import { buildColumnWidthsXml, buildStyleRegistry, resolveDataStyleId } from './excel-styles';
import type { ExportParams } from './types';

/**
 * Escape XML special characters.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Style registry produced by {@link buildStyleRegistry}. */
type StyleRegistry = ReturnType<typeof buildStyleRegistry>;
/** Excel style options resolved from {@link ExportParams.excelStyles}. */
type ExcelStyles = NonNullable<ExportParams['excelStyles']>;

/**
 * Emit the `<Styles>` block, pre-registering every dynamic `cellStyle` result so
 * the styles referenced by data cells actually exist in the workbook.
 */
function buildStylesXml(registry: StyleRegistry, styles: ExcelStyles, rows: any[], columns: ColumnConfig[]): string {
  if (styles.cellStyle) {
    for (const row of rows) {
      for (const col of columns) {
        const dynamic = styles.cellStyle(resolveCellValue(row, col), col.field, row);
        if (dynamic) registry.register(dynamic);
      }
    }
  }
  return registry.toXml();
}

/**
 * Plugin-contributed header rows (e.g. column groups) rendered above the leaf
 * header. Each row's cells must independently span the full column count;
 * `span > 1` becomes `ss:MergeAcross="span-1"` and Excel implicitly fills the
 * next `span-1` cell slots from the merge.
 */
function buildPluginHeaderRowsXml(params: ExportParams, groupHeaderStyleId: string | undefined): string {
  if (!params.headerRows?.length) return '';

  const styleAttr = groupHeaderStyleId ? ` ss:StyleID="${groupHeaderStyleId}"` : '';
  let xml = '';
  for (const headerRow of params.headerRows) {
    xml += '\n<Row>';
    for (const cell of headerRow.cells) {
      const span = Math.max(1, cell.span | 0);
      const mergeAttr = span > 1 ? ` ss:MergeAcross="${span - 1}"` : '';
      xml += `<Cell${styleAttr}${mergeAttr}><Data ss:Type="String">${escapeXml(cell.label ?? '')}</Data></Cell>`;
    }
    xml += '</Row>';
  }
  return xml;
}

/** The leaf header row, one cell per exported column. */
function buildHeaderRowXml(columns: ColumnConfig[], params: ExportParams, headerStyleId: string | undefined): string {
  const styleAttr = headerStyleId ? ` ss:StyleID="${headerStyleId}"` : '';
  let xml = '\n<Row>';
  for (const col of columns) {
    const header = col.header || col.field;
    const processed = params.processHeader ? params.processHeader(header, col.field) : header;
    xml += `<Cell${styleAttr}><Data ss:Type="String">${escapeXml(processed)}</Data></Cell>`;
  }
  return xml + '</Row>';
}

/** Map a resolved cell value onto an Excel `ss:Type` + already-escaped payload. */
function toExcelData(value: unknown): { type: 'Number' | 'String' | 'DateTime'; displayValue: string } {
  if (value == null) return { type: 'String', displayValue: '' };
  if (typeof value === 'number' && !isNaN(value)) return { type: 'Number', displayValue: String(value) };
  if (value instanceof Date) return { type: 'DateTime', displayValue: value.toISOString() };
  return { type: 'String', displayValue: escapeXml(String(value)) };
}

/** All data rows, applying `processCell` and per-cell style resolution. */
function buildDataRowsXml(
  rows: any[],
  columns: ColumnConfig[],
  params: ExportParams,
  registry: StyleRegistry | undefined,
  styles: ExcelStyles | undefined,
): string {
  let xml = '';
  for (const row of rows) {
    xml += '\n<Row>';
    for (const col of columns) {
      let value = resolveCellValue(row, col);
      if (params.processCell) value = params.processCell(value, col.field, row);

      const { type, displayValue } = toExcelData(value);

      const dataStyleId = registry && styles ? resolveDataStyleId(registry, styles, value, col.field, row) : undefined;
      const styleAttr = dataStyleId ? ` ss:StyleID="${dataStyleId}"` : '';

      xml += `<Cell${styleAttr}><Data ss:Type="${type}">${displayValue}</Data></Cell>`;
    }
    xml += '</Row>';
  }
  return xml;
}

/**
 * Build Excel XML content from rows and columns.
 * Uses XML Spreadsheet 2003 format for broad compatibility.
 */
export function buildExcelXml(rows: any[], columns: ColumnConfig[], params: ExportParams): string {
  const styles = params.excelStyles;
  const registry = styles ? buildStyleRegistry(styles) : undefined;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`;

  // Emit <Styles> block (only when styles are configured)
  if (registry && styles) xml += buildStylesXml(registry, styles, rows, columns);

  xml += '\n<Worksheet ss:Name="Sheet1">\n<Table>';

  // Column widths
  if (styles) xml += buildColumnWidthsXml(columns, rows as Record<string, unknown>[], styles);

  const headerStyleId = styles?.headerStyle && registry ? registry.getStyleId(styles.headerStyle) : undefined;
  // Group-header style ID (for plugin-contributed rows). Falls back to
  // headerStyleId so users get sensible defaults without configuring twice.
  const groupHeaderStyleId =
    styles?.groupHeaderStyle && registry ? registry.getStyleId(styles.groupHeaderStyle) : headerStyleId;

  if (params.includeHeaders !== false) {
    xml += buildPluginHeaderRowsXml(params, groupHeaderStyleId);
    xml += buildHeaderRowXml(columns, params, headerStyleId);
  }

  xml += buildDataRowsXml(rows, columns, params, registry, styles);

  xml += '\n</Table>\n</Worksheet>\n</Workbook>';
  return xml;
}

/**
 * Download Excel XML content as a file.
 */
export function downloadExcel(content: string, fileName: string): void {
  const blob = new Blob([content], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  downloadBlob(blob, fileName);
}
