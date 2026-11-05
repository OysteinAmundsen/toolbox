import { describe, expect, it } from 'vitest';
import { dataFieldSelector } from './data-field-selector';

describe('dataFieldSelector', () => {
  it.each(['name', '24" monitor|c1', 'a\\b|c1', `x'y"z\\`, 'line\nbreak', '\\22 literal', '2024-01|value', ''])(
    'matches %j exactly',
    (field) => {
      const host = document.createElement('div');
      const cell = document.createElement('div');
      cell.setAttribute('data-field', field);
      host.append(document.createElement('div'), cell);

      const matches = host.querySelectorAll(dataFieldSelector(field));
      expect(matches).toHaveLength(1);
      expect(matches[0]).toBe(cell);
    },
  );

  it('hex-escapes only quotes, backslashes and line breaks', () => {
    expect(dataFieldSelector('a"b\\c\nd|e f')).toBe('[data-field="a\\22 b\\5c c\\a d|e f"]');
  });
});
