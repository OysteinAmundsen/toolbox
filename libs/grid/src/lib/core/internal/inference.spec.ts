import { describe, expect, it } from 'vitest';
import { inferColumns, inferType, overlayInferred } from './inference';

describe('inference', () => {
  it('inferType handles primitives and date forms', () => {
    expect(inferType(123)).toBe('number');
    expect(inferType(true)).toBe('boolean');
    expect(inferType(new Date())).toBe('date');
    expect(inferType('2024-01-01')).toBe('date');
    expect(inferType('not-a-date')).toBe('string');
    expect(inferType(null)).toBe('string');
  });
  it('infers columns from first row with headers + typeMap', () => {
    const rows = [{ id: 1, name: 'A', active: false, joined: '2024-01-02' }];
    const { columns, typeMap } = inferColumns(rows);
    expect(columns.map((c) => c.field)).toEqual(['id', 'name', 'active', 'joined']);
    expect(typeMap).toMatchObject({ id: 'number', active: 'boolean', joined: 'date', name: 'string' });
  });
  it('returns provided columns untouched with type hints honored', () => {
    const provided: any = [
      { field: 'x', type: 'number' },
      { field: 'y', type: 'boolean' },
    ];
    const { columns, typeMap } = inferColumns([{ x: 1, y: true }], provided);
    expect(columns).toBe(provided);
    expect(typeMap).toEqual({ x: 'number', y: 'boolean' });
  });
});

describe('overlayInferred', () => {
  const inferred: any = [
    { field: 'id', header: 'Id', type: 'number' },
    { field: 'name', header: 'Name', type: 'string' },
    { field: 'salary', header: 'Salary', type: 'number' },
  ];

  it('returns inferred untouched when nothing is provided', () => {
    expect(overlayInferred(inferred, [])).toBe(inferred);
  });

  it('overlays a provided column in place, provided wins and inferred fills gaps', () => {
    const provided: any = [{ field: 'salary', header: 'Salary (USD)' }];
    const result = overlayInferred(inferred, provided);
    // Order preserved (data-key order)
    expect(result.map((c) => c.field)).toEqual(['id', 'name', 'salary']);
    const salary = result.find((c) => c.field === 'salary')!;
    // Provided header wins
    expect(salary.header).toBe('Salary (USD)');
    // Inferred type kept (gap filled)
    expect(salary.type).toBe('number');
  });

  it('does not let an undefined provided value clobber the inferred value', () => {
    const provided: any = [{ field: 'salary', header: undefined, type: 'number' }];
    const result = overlayInferred(inferred, provided);
    const salary = result.find((c) => c.field === 'salary')!;
    expect(salary.header).toBe('Salary');
  });

  it('appends provided columns for fields absent from the data as computed columns', () => {
    const provided: any = [{ field: 'actions', header: 'Actions' }];
    const result = overlayInferred(inferred, provided);
    expect(result.map((c) => c.field)).toEqual(['id', 'name', 'salary', 'actions']);
  });

  it('keeps in-place overlay and appended computed columns together', () => {
    const provided: any = [
      { field: 'name', header: 'Full name' },
      { field: 'actions', header: 'Actions' },
    ];
    const result = overlayInferred(inferred, provided);
    expect(result.map((c) => c.field)).toEqual(['id', 'name', 'salary', 'actions']);
    expect(result.find((c) => c.field === 'name')!.header).toBe('Full name');
  });
});
