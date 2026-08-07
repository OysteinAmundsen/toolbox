/**
 * Regression tests for CSV/TSV formula injection (CWE-1236).
 *
 * A cell whose exported text starts with `=`, `+`, `-`, `@`, TAB or CR is
 * interpreted as a formula by Excel / Google Sheets / LibreOffice. Prefixing
 * with a single quote neutralises it without changing the displayed value.
 */
import { describe, expect, it } from 'vitest';
import { formatDelimitedValue } from './data-collection';

const csv = { delimiter: ',', newline: '\n' } as const;

describe('formatDelimitedValue formula escaping', () => {
  it.each(['=1+1', '+1', '-1+1', '@SUM(A1)', '\tcmd'])('neutralises the trigger in %j', (payload) => {
    expect(formatDelimitedValue(payload, csv)).toBe(`'${payload}`);
  });

  it('neutralises and quotes a leading carriage return', () => {
    // A leading CR is both a formula trigger and a character that must be
    // quoted, so the prefix lands *inside* the quotes.
    expect(formatDelimitedValue('\rcmd', csv)).toBe(`"'\rcmd"`);
  });

  it('neutralises the classic remote-payload DDE string', () => {
    const attack = "=cmd|'/c calc'!A0";
    const out = formatDelimitedValue(attack, csv);
    expect(out.startsWith("'")).toBe(true);
    expect(out.startsWith('=')).toBe(false);
  });

  it('can be opted out of', () => {
    expect(formatDelimitedValue('=1+1', { ...csv, escapeFormulas: false })).toBe('=1+1');
  });

  it('leaves ordinary strings untouched', () => {
    expect(formatDelimitedValue('Acme Corp', csv)).toBe('Acme Corp');
  });

  it('does not touch negative numbers, which are unambiguously numeric', () => {
    expect(formatDelimitedValue(-5, csv)).toBe('-5');
  });

  it('quotes and escapes after prefixing so the quote is not lost', () => {
    expect(formatDelimitedValue('=a,b', csv)).toBe(`"'=a,b"`);
  });
});

describe('formatDelimitedValue quoting', () => {
  it('quotes on the configured delimiter, not a hardcoded comma', () => {
    expect(formatDelimitedValue('a;b', { delimiter: ';', newline: '\n' })).toBe('"a;b"');
    expect(formatDelimitedValue('a;b', csv)).toBe('a;b');
  });

  it('quotes on embedded newlines and carriage returns', () => {
    expect(formatDelimitedValue('a\nb', csv)).toBe('"a\nb"');
    expect(formatDelimitedValue('a\r\nb', csv)).toBe('"a\r\nb"');
  });

  it('doubles embedded quotes', () => {
    expect(formatDelimitedValue('say "hi"', csv)).toBe('"say ""hi"""');
  });

  it('honours quoting: always', () => {
    expect(formatDelimitedValue('plain', { ...csv, quoting: 'always' })).toBe('"plain"');
  });

  it('honours quoting: never', () => {
    expect(formatDelimitedValue('a,b', { ...csv, quoting: 'never' })).toBe('a,b');
  });

  it('serialises non-string primitives without quoting', () => {
    expect(formatDelimitedValue(42, csv)).toBe('42');
    expect(formatDelimitedValue(true, csv)).toBe('true');
    expect(formatDelimitedValue(null, csv)).toBe('');
    expect(formatDelimitedValue(undefined, csv)).toBe('');
  });
});
