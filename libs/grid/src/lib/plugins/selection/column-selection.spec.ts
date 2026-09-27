import { describe, expect, it } from 'vitest';
import {
  computeKeyboardExtension,
  fieldsBetween,
  indexOfField,
  normalizeMode,
  selectableColumnFields,
} from './column-selection';

describe('column-selection helpers', () => {
  describe('normalizeMode', () => {
    it('normalizes single-string modes', () => {
      expect(normalizeMode('cell')).toEqual({ primary: 'cell', columnEnabled: false, bothAxes: false });
      expect(normalizeMode('row')).toEqual({ primary: 'row', columnEnabled: false, bothAxes: false });
      expect(normalizeMode('range')).toEqual({ primary: 'range', columnEnabled: false, bothAxes: false });
    });

    it('marks column-only mode as columnEnabled', () => {
      expect(normalizeMode('column')).toEqual({ primary: 'column', columnEnabled: true, bothAxes: false });
    });

    it('handles two-element arrays containing column', () => {
      expect(normalizeMode(['column', 'row'])).toEqual({ primary: 'row', columnEnabled: true, bothAxes: true });
      expect(normalizeMode(['row', 'column'])).toEqual({ primary: 'row', columnEnabled: true, bothAxes: true });
      expect(normalizeMode(['column', 'cell'])).toEqual({ primary: 'cell', columnEnabled: true, bothAxes: true });
      expect(normalizeMode(['column', 'range'])).toEqual({ primary: 'range', columnEnabled: true, bothAxes: true });
    });

    it('treats single-element arrays as the contained string', () => {
      expect(normalizeMode(['row'])).toEqual({ primary: 'row', columnEnabled: false, bothAxes: false });
      expect(normalizeMode(['column'])).toEqual({ primary: 'column', columnEnabled: true, bothAxes: false });
    });

    it('throws on invalid mode strings', () => {
      // @ts-expect-error - intentional bad input
      expect(() => normalizeMode('bogus')).toThrow(/Invalid selection mode/);
    });

    it('throws on empty arrays', () => {
      expect(() => normalizeMode([])).toThrow(/at least one mode/);
    });

    it('throws on 3+ element arrays', () => {
      expect(() => normalizeMode(['cell', 'row', 'column'])).toThrow(/more than 2 modes/);
    });

    it('throws on duplicate entries', () => {
      expect(() => normalizeMode(['column', 'column'])).toThrow(/duplicate/);
    });

    it('throws on 2-element arrays without column', () => {
      // cell+row, cell+range, row+range don't compose
      expect(() => normalizeMode(['cell', 'row'])).toThrow();
      expect(() => normalizeMode(['cell', 'range'])).toThrow();
      expect(() => normalizeMode(['row', 'range'])).toThrow();
    });

    it('throws on non-string non-array input', () => {
      // @ts-expect-error - intentional bad input
      expect(() => normalizeMode(null)).toThrow();
      // @ts-expect-error - intentional bad input
      expect(() => normalizeMode(123)).toThrow();
    });
  });

  describe('selectableColumnFields', () => {
    it('returns field names of non-utility columns in order', () => {
      const cols = [
        { field: 'a', utility: true },
        { field: 'b' },
        { field: 'c' },
        { field: 'd', utility: true },
        { field: 'e' },
      ];
      expect(selectableColumnFields(cols as any)).toEqual(['b', 'c', 'e']);
    });

    it('skips entries without a string field', () => {
      const cols = [{ field: 'a' }, {}, { field: 'b' }, { field: 123 }];
      expect(selectableColumnFields(cols as any)).toEqual(['a', 'b']);
    });

    it('returns empty array for empty input', () => {
      expect(selectableColumnFields([])).toEqual([]);
    });
  });

  describe('indexOfField / fieldsBetween', () => {
    const fields = ['a', 'b', 'c', 'd', 'e'];

    it('indexOfField returns the position', () => {
      expect(indexOfField('a', fields)).toBe(0);
      expect(indexOfField('e', fields)).toBe(4);
      expect(indexOfField('zzz', fields)).toBe(-1);
    });

    it('fieldsBetween returns inclusive forward range', () => {
      expect(fieldsBetween('b', 'd', fields)).toEqual(['b', 'c', 'd']);
    });

    it('fieldsBetween returns inclusive reverse range in visible order', () => {
      expect(fieldsBetween('d', 'b', fields)).toEqual(['b', 'c', 'd']);
    });

    it('fieldsBetween handles same-anchor-and-target', () => {
      expect(fieldsBetween('c', 'c', fields)).toEqual(['c']);
    });

    it('fieldsBetween returns empty when either field is missing', () => {
      expect(fieldsBetween('nope', 'c', fields)).toEqual([]);
      expect(fieldsBetween('c', 'nope', fields)).toEqual([]);
    });
  });

  describe('computeKeyboardExtension', () => {
    const fields = ['a', 'b', 'c', 'd'];

    it('moves head right', () => {
      expect(computeKeyboardExtension('b', fields, 'right')).toBe('c');
    });

    it('moves head left', () => {
      expect(computeKeyboardExtension('c', fields, 'left')).toBe('b');
    });

    it('clamps at the end of the visible columns', () => {
      expect(computeKeyboardExtension('d', fields, 'right')).toBeNull();
      expect(computeKeyboardExtension('a', fields, 'left')).toBeNull();
    });

    it('returns null when head is unknown', () => {
      expect(computeKeyboardExtension('zzz', fields, 'right')).toBeNull();
      expect(computeKeyboardExtension(null, fields, 'right')).toBeNull();
    });
  });
});
