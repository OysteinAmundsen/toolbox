import { describe, expect, it } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import { buildExcelXml } from './excel';
import { buildColumnWidthsXml, buildStyleRegistry, resolveDataStyleId, StyleRegistry } from './excel-styles';
import type { ExcelCellStyle, ExcelStyleConfig, ExportParams } from './types';

// #region StyleRegistry

describe('StyleRegistry', () => {
  it('registers a style and returns an ID', () => {
    const registry = new StyleRegistry();
    const id = registry.register({ font: { bold: true } });
    expect(id).toBe('s1');
    expect(registry.size).toBe(1);
  });

  it('deduplicates identical styles', () => {
    const registry = new StyleRegistry();
    const id1 = registry.register({ font: { bold: true } });
    const id2 = registry.register({ font: { bold: true } });
    expect(id1).toBe(id2);
    expect(registry.size).toBe(1);
  });

  it('assigns different IDs to different styles', () => {
    const registry = new StyleRegistry();
    const id1 = registry.register({ font: { bold: true } });
    const id2 = registry.register({ font: { italic: true } });
    expect(id1).not.toBe(id2);
    expect(registry.size).toBe(2);
  });

  it('deduplicates regardless of property order', () => {
    const registry = new StyleRegistry();
    const id1 = registry.register({ font: { bold: true, size: 12 } });
    const id2 = registry.register({ font: { size: 12, bold: true } });
    expect(id1).toBe(id2);
    expect(registry.size).toBe(1);
  });

  it('looks up style ID via getStyleId', () => {
    const registry = new StyleRegistry();
    registry.register({ font: { bold: true } });
    expect(registry.getStyleId({ font: { bold: true } })).toBe('s1');
    expect(registry.getStyleId({ font: { italic: true } })).toBeUndefined();
  });

  it('returns empty string from toXml when no styles', () => {
    const registry = new StyleRegistry();
    expect(registry.toXml()).toBe('');
  });
});

// #endregion

// #region Style XML Generation

describe('Style XML generation', () => {
  it('emits font attributes', () => {
    const registry = new StyleRegistry();
    registry.register({ font: { name: 'Arial', size: 14, bold: true, italic: true, color: '#FF0000' } });
    const xml = registry.toXml();

    expect(xml).toContain('ss:FontName="Arial"');
    expect(xml).toContain('ss:Size="14"');
    expect(xml).toContain('ss:Bold="1"');
    expect(xml).toContain('ss:Italic="1"');
    expect(xml).toContain('ss:Color="#FF0000"');
  });

  it('emits fill/interior with default Solid pattern', () => {
    const registry = new StyleRegistry();
    registry.register({ fill: { color: '#FFFF00' } });
    const xml = registry.toXml();

    expect(xml).toContain('ss:Color="#FFFF00"');
    expect(xml).toContain('ss:Pattern="Solid"');
  });

  it('emits fill with explicit None pattern', () => {
    const registry = new StyleRegistry();
    registry.register({ fill: { color: '#000000', pattern: 'None' } });
    const xml = registry.toXml();

    expect(xml).toContain('ss:Pattern="None"');
  });

  it('emits number format', () => {
    const registry = new StyleRegistry();
    registry.register({ numberFormat: '#,##0.00' });
    const xml = registry.toXml();

    expect(xml).toContain('ss:Format="#,##0.00"');
  });

  it('emits alignment attributes', () => {
    const registry = new StyleRegistry();
    registry.register({ alignment: { horizontal: 'Center', vertical: 'Top', wrapText: true } });
    const xml = registry.toXml();

    expect(xml).toContain('ss:Horizontal="Center"');
    expect(xml).toContain('ss:Vertical="Top"');
    expect(xml).toContain('ss:WrapText="1"');
  });

  it('emits border elements for all four sides', () => {
    const registry = new StyleRegistry();
    registry.register({
      borders: {
        top: { style: 'Thin', color: '#000000' },
        bottom: { style: 'Medium' },
        left: { style: 'Thick', color: '#FF0000' },
        right: { style: 'Thin' },
      },
    });
    const xml = registry.toXml();

    expect(xml).toContain('ss:Position="Top"');
    expect(xml).toContain('ss:Position="Bottom"');
    expect(xml).toContain('ss:Position="Left"');
    expect(xml).toContain('ss:Position="Right"');
    expect(xml).toContain('ss:Weight="1"'); // Thin
    expect(xml).toContain('ss:Weight="2"'); // Medium
    expect(xml).toContain('ss:Weight="3"'); // Thick
  });
});

// #endregion

// #region buildStyleRegistry & resolveDataStyleId

describe('buildStyleRegistry', () => {
  it('pre-registers header, default, and column styles', () => {
    const config: ExcelStyleConfig = {
      headerStyle: { font: { bold: true } },
      defaultStyle: { font: { size: 10 } },
      columnStyles: {
        salary: { numberFormat: '#,##0.00' },
        name: { alignment: { horizontal: 'Left' } },
      },
    };

    const registry = buildStyleRegistry(config);
    // header + default + 2 column styles = 4
    expect(registry.size).toBe(4);
  });

  it('deduplicates when column style equals default', () => {
    const sharedStyle: ExcelCellStyle = { font: { size: 10 } };
    const config: ExcelStyleConfig = {
      defaultStyle: sharedStyle,
      columnStyles: { name: sharedStyle },
    };

    const registry = buildStyleRegistry(config);
    expect(registry.size).toBe(1);
  });
});

describe('resolveDataStyleId', () => {
  it('returns defaultStyle ID when no overrides', () => {
    const config: ExcelStyleConfig = { defaultStyle: { font: { size: 10 } } };
    const registry = buildStyleRegistry(config);

    const id = resolveDataStyleId(registry, config, 'hello', 'name', {});
    expect(id).toBe(registry.getStyleId(config.defaultStyle!));
  });

  it('returns columnStyles ID over default', () => {
    const config: ExcelStyleConfig = {
      defaultStyle: { font: { size: 10 } },
      columnStyles: { salary: { numberFormat: '#,##0' } },
    };
    const registry = buildStyleRegistry(config);

    const id = resolveDataStyleId(registry, config, 50000, 'salary', {});
    expect(id).toBe(registry.getStyleId(config.columnStyles!['salary']));
    expect(id).not.toBe(registry.getStyleId(config.defaultStyle!));
  });

  it('returns cellStyle callback result over everything', () => {
    const dynamicStyle: ExcelCellStyle = { fill: { color: '#FF0000' } };
    const config: ExcelStyleConfig = {
      defaultStyle: { font: { size: 10 } },
      columnStyles: { salary: { numberFormat: '#,##0' } },
      cellStyle: () => dynamicStyle,
    };
    const registry = buildStyleRegistry(config);

    const id = resolveDataStyleId(registry, config, 50000, 'salary', {});
    // Dynamic style registered on-the-fly
    expect(id).toBe(registry.getStyleId(dynamicStyle));
  });

  it('falls through when cellStyle returns undefined', () => {
    const config: ExcelStyleConfig = {
      defaultStyle: { font: { size: 10 } },
      cellStyle: () => undefined,
    };
    const registry = buildStyleRegistry(config);

    const id = resolveDataStyleId(registry, config, 'val', 'field', {});
    expect(id).toBe(registry.getStyleId(config.defaultStyle!));
  });

  it('returns undefined when no styles configured', () => {
    const config: ExcelStyleConfig = {};
    const registry = buildStyleRegistry(config);

    const id = resolveDataStyleId(registry, config, 'val', 'field', {});
    expect(id).toBeUndefined();
  });
});

// #endregion

// #region Column Widths

describe('buildColumnWidthsXml', () => {
  const columns = [
    { field: 'name', header: 'Name' },
    { field: 'age', header: 'Age' },
  ];

  it('returns empty string when no widths or autoFit', () => {
    expect(buildColumnWidthsXml(columns, [], {})).toBe('');
  });

  it('generates Column elements for explicit widths', () => {
    const config: ExcelStyleConfig = { columnWidths: { name: 20, age: 10 } };
    const xml = buildColumnWidthsXml(columns, [], config);

    // 20 * 7 = 140, 10 * 7 = 70
    expect(xml).toContain('ss:Width="140"');
    expect(xml).toContain('ss:Width="70"');
  });

  it('auto-fits based on content', () => {
    const rows = [{ name: 'LongEmployeeName', age: 99 }];
    const config: ExcelStyleConfig = { autoFitColumns: true };
    const xml = buildColumnWidthsXml(columns, rows as Record<string, unknown>[], config);

    // 'LongEmployeeName' = 16 chars + 2 padding = 18 * 7 = 126
    expect(xml).toContain('ss:Width="126"');
  });

  it('explicit width takes precedence over auto-fit', () => {
    const rows = [{ name: 'LongEmployeeName', age: 99 }];
    const config: ExcelStyleConfig = { autoFitColumns: true, columnWidths: { name: 30 } };
    const xml = buildColumnWidthsXml(columns, rows as Record<string, unknown>[], config);

    // Explicit 30 * 7 = 210, not the auto-fit value
    expect(xml).toContain('ss:Width="210"');
  });
});

// #endregion

// #region buildExcelXml with styles integration

describe('buildExcelXml with excelStyles', () => {
  const sampleColumns: ColumnConfig[] = [
    { field: 'name', header: 'Name' },
    { field: 'value', header: 'Value' },
  ];

  const sampleRows = [
    { name: 'Item A', value: 100 },
    { name: 'Item B', value: 200 },
  ];

  it('produces no <Styles> block when excelStyles is absent (backward compatible)', () => {
    const params: ExportParams = { format: 'excel' };
    const result = buildExcelXml(sampleRows, sampleColumns, params);

    expect(result).not.toContain('<Styles>');
    expect(result).not.toContain('ss:StyleID');
  });

  it('emits <Styles> block when headerStyle is set', () => {
    const params: ExportParams = {
      format: 'excel',
      excelStyles: { headerStyle: { font: { bold: true, size: 12 } } },
    };
    const result = buildExcelXml(sampleRows, sampleColumns, params);

    expect(result).toContain('<Styles>');
    expect(result).toContain('ss:Bold="1"');
    expect(result).toContain('ss:Size="12"');
  });

  it('applies header style ID to header cells', () => {
    const params: ExportParams = {
      format: 'excel',
      excelStyles: { headerStyle: { font: { bold: true } } },
    };
    const result = buildExcelXml(sampleRows, sampleColumns, params);

    // Header cells should have ss:StyleID
    const headerRowMatch = result.match(/<Row>(.*?)<\/Row>/s);
    expect(headerRowMatch?.[1]).toContain('ss:StyleID="s1"');
  });

  it('applies per-column styles to data cells', () => {
    const params: ExportParams = {
      format: 'excel',
      excelStyles: {
        columnStyles: { value: { numberFormat: '#,##0.00' } },
      },
    };
    const result = buildExcelXml(sampleRows, sampleColumns, params);

    // Value cells should have style, name cells should not
    expect(result).toContain('<Cell ss:StyleID="s1"><Data ss:Type="Number">100</Data></Cell>');
    // The "name" cells should have no style attribute
    expect(result).toContain('<Cell><Data ss:Type="String">Item A</Data></Cell>');
  });

  it('applies default style to all data cells', () => {
    const params: ExportParams = {
      format: 'excel',
      excelStyles: { defaultStyle: { font: { name: 'Calibri' } } },
    };
    const result = buildExcelXml(sampleRows, sampleColumns, params);

    // All data cells should have the style
    const dataCells = result.match(/<Cell ss:StyleID="s1"><Data/g);
    // 2 rows × 2 columns = 4 styled data cells
    expect(dataCells).toHaveLength(4);
  });

  it('cellStyle callback overrides column defaults', () => {
    const params: ExportParams = {
      format: 'excel',
      excelStyles: {
        columnStyles: { value: { font: { size: 10 } } },
        cellStyle: (value) => {
          if (typeof value === 'number' && value > 150) {
            return { fill: { color: '#FF0000' } };
          }
          return undefined;
        },
      },
    };
    const result = buildExcelXml(sampleRows, sampleColumns, params);

    // Value 200 should get the red fill style, value 100 should get column style
    expect(result).toContain('ss:Color="#FF0000"');
  });

  it('generates column width elements', () => {
    const params: ExportParams = {
      format: 'excel',
      excelStyles: { columnWidths: { name: 20, value: 15 } },
    };
    const result = buildExcelXml(sampleRows, sampleColumns, params);

    expect(result).toContain('<Column ss:Width="140"/>');
    expect(result).toContain('<Column ss:Width="105"/>');
  });

  it('number format renders correctly for currency', () => {
    const params: ExportParams = {
      format: 'excel',
      excelStyles: { columnStyles: { value: { numberFormat: '$#,##0.00' } } },
    };
    const result = buildExcelXml(sampleRows, sampleColumns, params);

    expect(result).toContain('ss:Format="$#,##0.00"');
  });

  it('number format renders correctly for percentage', () => {
    const params: ExportParams = {
      format: 'excel',
      excelStyles: { columnStyles: { value: { numberFormat: '0%' } } },
    };
    const result = buildExcelXml(sampleRows, sampleColumns, params);

    expect(result).toContain('ss:Format="0%"');
  });

  it('number format renders correctly for date', () => {
    const params: ExportParams = {
      format: 'excel',
      excelStyles: { columnStyles: { value: { numberFormat: 'yyyy-mm-dd' } } },
    };
    const result = buildExcelXml(sampleRows, sampleColumns, params);

    expect(result).toContain('ss:Format="yyyy-mm-dd"');
  });

  it('empty excelStyles object produces no <Styles> block', () => {
    const params: ExportParams = { format: 'excel', excelStyles: {} };
    const result = buildExcelXml(sampleRows, sampleColumns, params);

    expect(result).not.toContain('<Styles>');
    expect(result).not.toContain('ss:StyleID');
  });
});

// #endregion
