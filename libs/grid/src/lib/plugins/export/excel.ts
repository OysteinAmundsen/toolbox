/**
 * Excel Export Utilities
 *
 * Simple Excel XML format export (no external dependencies).
 * Produces XML Spreadsheet 2003 format which opens in Excel.
 */

import type { ColumnConfig } from '../../core/types';
import type { ExportParams } from './types';
import { downloadBlob } from './csv';

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

/**
 * Build Excel XML content from rows and columns.
 * Uses XML Spreadsheet 2003 format for broad compatibility.
 */
export function buildExcelXml(rows: any[], columns: ColumnConfig[], params: ExportParams): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Sheet1">
<Table>`;

  // Build header row
  if (params.includeHeaders !== false) {
    xml += '\n<Row>';
    for (const col of columns) {
      const header = col.header || col.field;
      const processed = params.processHeader ? params.processHeader(header, col.field) : header;
      xml += `<Cell><Data ss:Type="String">${escapeXml(processed)}</Data></Cell>`;
    }
    xml += '</Row>';
  }

  // Build data rows
  for (const row of rows) {
    xml += '\n<Row>';
    for (const col of columns) {
      let value = row[col.field];
      if (params.processCell) {
        value = params.processCell(value, col.field, row);
      }

      // Determine cell type based on value
      let type: 'Number' | 'String' | 'DateTime' = 'String';
      let displayValue = '';

      if (value == null) {
        displayValue = '';
      } else if (typeof value === 'number' && !isNaN(value)) {
        type = 'Number';
        displayValue = String(value);
      } else if (value instanceof Date) {
        type = 'DateTime';
        displayValue = value.toISOString();
      } else {
        displayValue = escapeXml(String(value));
      }

      xml += `<Cell><Data ss:Type="${type}">${displayValue}</Data></Cell>`;
    }
    xml += '</Row>';
  }

  xml += '\n</Table>\n</Worksheet>\n</Workbook>';
  return xml;
}

/**
 * Download Excel XML content as a file.
 */
export function downloadExcel(content: string, fileName: string): void {
  const finalName = fileName.endsWith('.xls') ? fileName : `${fileName}.xls`;
  const blob = new Blob([content], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  downloadBlob(blob, finalName);
}
