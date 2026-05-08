/**
 * Column-shorthand Benchmarks (Vue adapter)
 *
 * Mirrors the React adapter's column-shorthand bench. The Vue and React
 * implementations are kept byte-equivalent (see file header in
 * `column-shorthand.ts`); benching both keeps us honest if one drifts.
 */

import { bench, describe } from 'vitest';
import {
  applyColumnDefaults,
  hasColumnShorthands,
  normalizeColumns,
  parseColumnShorthand,
  type ColumnShorthand,
} from './column-shorthand';

// #region Fixtures

const SHORT_FIELDS = ['id', 'name', 'email', 'phone', 'department', 'team', 'salary', 'hired'];
const TYPED_FIELDS = ['id:number', 'name', 'salary:currency', 'hired:date', 'active:boolean'];
const FULL_OBJECTS = SHORT_FIELDS.map((f) => ({ field: f, header: f, width: 120 }));

const MIXED_10: ColumnShorthand[] = [
  'id:number',
  'name',
  { field: 'email', width: 200 },
  'phone',
  'department',
  { field: 'salary', type: 'currency' },
  'hired:date',
  'active:boolean',
  'manager',
  { field: 'notes', width: 300 },
];

const MIXED_50: ColumnShorthand[] = Array.from({ length: 50 }, (_, i) =>
  i % 3 === 0 ? `field${i}` : i % 3 === 1 ? `field${i}:number` : { field: `field${i}`, header: `Col ${i}`, width: 100 },
);

const DEFAULTS = { sortable: true, resizable: true };

// #endregion

describe('parseColumnShorthand', () => {
  bench('plain field name', () => {
    parseColumnShorthand('name');
  });

  bench('field with type suffix', () => {
    parseColumnShorthand('salary:currency');
  });

  bench('camelCase header generation', () => {
    parseColumnShorthand('firstName');
  });
});

describe('normalizeColumns', () => {
  bench('8 string fields', () => {
    normalizeColumns(SHORT_FIELDS);
  });

  bench('5 typed fields', () => {
    normalizeColumns(TYPED_FIELDS);
  });

  bench('8 full objects (passthrough)', () => {
    normalizeColumns(FULL_OBJECTS);
  });

  bench('10 mixed', () => {
    normalizeColumns(MIXED_10);
  });

  bench('50 mixed', () => {
    normalizeColumns(MIXED_50);
  });
});

describe('applyColumnDefaults', () => {
  const cols = normalizeColumns(MIXED_10);
  bench('10 columns', () => {
    applyColumnDefaults(cols, DEFAULTS);
  });
});

describe('hasColumnShorthands', () => {
  bench('10 mixed (early hit)', () => {
    hasColumnShorthands(MIXED_10);
  });

  bench('8 full objects (full scan)', () => {
    hasColumnShorthands(FULL_OBJECTS);
  });
});
