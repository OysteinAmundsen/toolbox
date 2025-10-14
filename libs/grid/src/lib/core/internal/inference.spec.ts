import { describe, expect, it } from 'vitest';
import { inferColumns, inferType } from './inference';

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
