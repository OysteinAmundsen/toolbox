/**
 * Tests for the core column-shorthand parser (issue #276). The framework
 * adapters re-export these helpers, so this is the single source of truth for
 * shorthand behavior.
 */
import { describe, expect, it } from 'vitest';
import { applyColumnDefaults, hasColumnShorthands, normalizeColumns, parseColumnShorthand } from './column-shorthand';

describe('parseColumnShorthand', () => {
  it('parses a simple field name and generates a header', () => {
    expect(parseColumnShorthand('name')).toEqual({ field: 'name', header: 'Name' });
  });

  it('parses a field with a recognized type suffix', () => {
    expect(parseColumnShorthand('salary:number')).toEqual({ field: 'salary', header: 'Salary', type: 'number' });
  });

  it('is case-insensitive on the type suffix', () => {
    expect(parseColumnShorthand('id:NUMBER')).toEqual({ field: 'id', header: 'ID', type: 'number' });
  });

  it('treats an unknown suffix as part of the field name', () => {
    expect(parseColumnShorthand('field:unknown')).toEqual({ field: 'field:unknown', header: 'Field:unknown' });
  });

  it('uses only the last colon when resolving the type', () => {
    expect(parseColumnShorthand('time:12:30').field).toBe('time:12:30');
  });

  it('humanizes camelCase, snake_case and kebab-case', () => {
    expect(parseColumnShorthand('firstName').header).toBe('First Name');
    expect(parseColumnShorthand('first_name').header).toBe('First Name');
    expect(parseColumnShorthand('first-name').header).toBe('First Name');
  });

  it('special-cases `id` → `ID`', () => {
    expect(parseColumnShorthand('id').header).toBe('ID');
  });
});

describe('normalizeColumns', () => {
  it('expands string shorthands and passes objects through by reference', () => {
    const config = { field: 'email', width: 200, sortable: true };
    const result = normalizeColumns(['id:number', 'name', config]);
    expect(result[0]).toEqual({ field: 'id', header: 'ID', type: 'number' });
    expect(result[1]).toEqual({ field: 'name', header: 'Name' });
    expect(result[2]).toBe(config);
  });

  it('handles an empty array', () => {
    expect(normalizeColumns([])).toEqual([]);
  });
});

describe('applyColumnDefaults', () => {
  it('returns the same array when there are no defaults', () => {
    const cols = [{ field: 'a' }];
    expect(applyColumnDefaults(cols, undefined)).toBe(cols);
  });

  it('merges defaults under each column, letting per-column values win', () => {
    expect(applyColumnDefaults([{ field: 'a', sortable: false }, { field: 'b' }], { sortable: true })).toEqual([
      { field: 'a', sortable: false },
      { field: 'b', sortable: true },
    ]);
  });
});

describe('hasColumnShorthands', () => {
  it('detects string entries', () => {
    expect(hasColumnShorthands(['id', { field: 'name' }])).toBe(true);
    expect(hasColumnShorthands([{ field: 'id' }, { field: 'name' }])).toBe(false);
  });
});
