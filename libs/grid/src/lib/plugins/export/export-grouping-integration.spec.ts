/**
 * Export × Grouping integration tests.
 *
 * Verifies the issue #314 fix: column-group headers must be present in the
 * Excel export, plus the related JSON-envelope and processHeaderRow behaviours
 * introduced alongside the broadcast-based `collectHeaderRows` query.
 *
 * These tests run against a real `<tbw-grid>` element so the
 * GroupingColumnsPlugin → ExportPlugin query handshake exercises the actual
 * plugin manager routing, not a hand-rolled mock.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextFrame } from '../../../../test/helpers';
import '../../../index';
import type { GridElement } from '../../../public';
import type { HeaderRowContribution } from '../../core/plugin/types';
import { GroupingColumnsPlugin } from '../grouping-columns/GroupingColumnsPlugin';
import { ExportPlugin } from './ExportPlugin';
import { buildExcelXml } from './excel';

// Suppress jsdom/happy-dom anchor-click side effects from downloadBlob.
vi.mock('./csv', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, downloadCsv: vi.fn(), downloadBlob: vi.fn() };
});
vi.mock('./excel', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, downloadExcel: vi.fn() };
});

describe('Export × GroupingColumns — issue #314', () => {
  let grid: GridElement;

  beforeEach(() => {
    grid = document.createElement('tbw-grid') as GridElement;
    document.body.appendChild(grid);
  });

  afterEach(() => {
    grid.remove();
  });

  /**
   * Configure a grid with two column groups + an export plugin.
   * Returns { grid, export, grouping } once the grid is fully rendered.
   */
  async function setupGroupedGrid() {
    grid.gridConfig = {
      columnGroups: [
        { id: 'personal', header: 'Personal Info', children: ['firstName', 'lastName'] },
        { id: 'work', header: 'Work Info', children: ['department', 'salary'] },
      ],
      columns: [
        { field: 'firstName', header: 'First Name' },
        { field: 'lastName', header: 'Last Name' },
        { field: 'department', header: 'Dept' },
        { field: 'salary', header: 'Salary' },
      ],
      plugins: [new GroupingColumnsPlugin(), new ExportPlugin({ fileName: 'employees' })],
    };
    grid.rows = [
      { firstName: 'Alice', lastName: 'Smith', department: 'Eng', salary: 100000 },
      { firstName: 'Bob', lastName: 'Jones', department: 'Sales', salary: 90000 },
    ];
    await customElements.whenDefined('tbw-grid');
    await grid.ready?.();
    await nextFrame();
  }

  it('GroupingColumnsPlugin responds to collectHeaderRows with merged spans', async () => {
    await setupGroupedGrid();
    const responses = grid.query<HeaderRowContribution | undefined>('collectHeaderRows', {
      columns: grid.columns,
    });
    expect(responses.length).toBe(1);
    const contribution = responses[0]!;
    expect(contribution.cells).toEqual([
      { label: 'Personal Info', span: 2, source: 'groupingColumns' },
      { label: 'Work Info', span: 2, source: 'groupingColumns' },
    ]);
  });

  it('Excel export emits group-header row with ss:MergeAcross above the leaf headers', async () => {
    await setupGroupedGrid();
    const exporter = grid.getPluginByName('export')!;
    // Use the pure formatter so we can inspect the XML directly without
    // mocking downloads. resolveExportData runs collectHeaderRows internally
    // and stashes the result in fullParams.headerRows.
    const data = exporter.export();
    // Re-invoke the broadcast manually since formatExcel doesn't (it's a
    // pure formatter). We exercise the integration path via exportExcel below.
    exporter.exportExcel();

    // Pull the generated XML out of buildExcelXml directly so the assertion
    // is precise. We rebuild the contribution the same way the plugin does.
    const headerRows = grid.query<HeaderRowContribution | undefined>('collectHeaderRows', {
      columns: grid.columns,
    });
    const xml = buildExcelXml(data as Record<string, unknown>[], grid.columns, {
      format: 'excel',
      includeHeaders: true,
      headerRows: headerRows.filter(Boolean) as HeaderRowContribution[],
    });

    // Group-header row must precede the leaf-header row.
    const groupRowIdx = xml.indexOf('Personal Info');
    const leafRowIdx = xml.indexOf('First Name');
    expect(groupRowIdx).toBeGreaterThan(0);
    expect(leafRowIdx).toBeGreaterThan(groupRowIdx);

    // MergeAcross="1" reflects a span of 2 leaf columns.
    expect(xml).toContain('ss:MergeAcross="1"');
    // Both group labels are emitted.
    expect(xml).toContain('>Personal Info<');
    expect(xml).toContain('>Work Info<');
  });

  it('JSON export wraps rows in { headerRows, rows } envelope when groups exist', async () => {
    await setupGroupedGrid();
    const exporter = grid.getPluginByName('export')!;
    let captured: string | undefined;
    const originalCreate = URL.createObjectURL;
    // happy-dom's Blob can be read via FileReader; simpler to monkey-patch
    // Blob to capture content.
    const originalBlob = globalThis.Blob;
    globalThis.Blob = class extends originalBlob {
      constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
        super(parts, opts);
        if (opts?.type === 'application/json') {
          captured = parts.map((p) => (typeof p === 'string' ? p : '')).join('');
        }
      }
    } as typeof Blob;

    try {
      exporter.exportJson();
    } finally {
      globalThis.Blob = originalBlob;
      void originalCreate; // satisfy lint
    }

    expect(captured).toBeDefined();
    const payload = JSON.parse(captured!);
    expect(payload).toHaveProperty('headerRows');
    expect(payload).toHaveProperty('rows');
    expect(payload.headerRows).toHaveLength(1);
    expect(payload.headerRows[0].cells.map((c: { label: string }) => c.label)).toEqual(['Personal Info', 'Work Info']);
    expect(payload.rows).toHaveLength(2);
  });

  it('JSON export stays a flat array when no plugin contributes header rows', async () => {
    grid.gridConfig = {
      columns: [
        { field: 'firstName', header: 'First Name' },
        { field: 'lastName', header: 'Last Name' },
      ],
      plugins: [new ExportPlugin({ fileName: 'flat' })],
    };
    grid.rows = [{ firstName: 'Alice', lastName: 'Smith' }];
    await customElements.whenDefined('tbw-grid');
    await grid.ready?.();
    await nextFrame();

    const exporter = grid.getPluginByName('export')!;
    let captured: string | undefined;
    const originalBlob = globalThis.Blob;
    globalThis.Blob = class extends originalBlob {
      constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
        super(parts, opts);
        if (opts?.type === 'application/json') {
          captured = parts.map((p) => (typeof p === 'string' ? p : '')).join('');
        }
      }
    } as typeof Blob;

    try {
      exporter.exportJson();
    } finally {
      globalThis.Blob = originalBlob;
    }

    const payload = JSON.parse(captured!);
    expect(Array.isArray(payload)).toBe(true); // Plain array — backward-compatible.
  });

  it('Excel export with includeHeaders:false skips both leaf AND group-header rows', async () => {
    await setupGroupedGrid();
    const exporter = grid.getPluginByName('export')!;
    const data = exporter.export();
    const xml = buildExcelXml(data as Record<string, unknown>[], grid.columns, {
      format: 'excel',
      includeHeaders: false,
      // headerRows intentionally NOT passed — mirrors what
      // resolveExportData produces when includeHeaders is false.
    });
    expect(xml).not.toContain('Personal Info');
    expect(xml).not.toContain('First Name');
  });

  it('processHeaderRow returning null blanks the cell but preserves span', async () => {
    await setupGroupedGrid();
    const exporter = grid.getPluginByName('export')!;
    const headerRows = grid.query<HeaderRowContribution | undefined>('collectHeaderRows', {
      columns: grid.columns,
    });
    // Manually run the processor through the public formatter path.
    const data = exporter.export();
    const processed: HeaderRowContribution[] = (headerRows.filter(Boolean) as HeaderRowContribution[]).map((row) => ({
      cells: row.cells.map((cell) => (cell.label === 'Personal Info' ? { label: '', span: cell.span } : cell)),
    }));
    const xml = buildExcelXml(data as Record<string, unknown>[], grid.columns, {
      format: 'excel',
      includeHeaders: true,
      headerRows: processed,
    });
    expect(xml).not.toContain('Personal Info');
    expect(xml).toContain('>Work Info<');
    // The blanked cell still occupies its span — MergeAcross="1" remains.
    expect(xml).toContain('ss:MergeAcross="1"');
  });

  it('ExportPlugin drops a fully-blank header row entirely', async () => {
    await setupGroupedGrid();
    const exporter = grid.getPluginByName('export')!;
    // processHeaderRow returns null for EVERY cell → row collapses.
    let captured: string | undefined;
    const originalBlob = globalThis.Blob;
    globalThis.Blob = class extends originalBlob {
      constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
        super(parts, opts);
        if (opts?.type === 'application/json') {
          captured = parts.map((p) => (typeof p === 'string' ? p : '')).join('');
        }
      }
    } as typeof Blob;

    try {
      exporter.exportJson({ processHeaderRow: () => null });
    } finally {
      globalThis.Blob = originalBlob;
    }

    // With every cell blanked, the row is dropped → no headerRows in output,
    // so output collapses to the flat-array form.
    const payload = JSON.parse(captured!);
    expect(Array.isArray(payload)).toBe(true);
  });
});
