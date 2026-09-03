/**
 * Unit tests for `serializeColumnOptions`.
 *
 * The final case re-implements core's `options` parsing to pin the round-trip
 * contract — if `parseLightDomColumns` ever changes its CSV grammar, this test
 * is the tripwire.
 */

import { describe, expect, it, vi } from 'vitest';
import { serializeColumnOptions } from './column-options';

/** Mirror of the `options` branch in core's `parseLightDomColumns`. */
function parseOptionsAttr(attr: string) {
  return attr.split(',').map((item) => {
    const [value, label] = item.includes(':') ? item.split(':') : [item.trim(), item.trim()];
    return { value: value.trim(), label: label?.trim() || value.trim() };
  });
}

describe('serializeColumnOptions', () => {
  it('returns undefined for an empty list so the attribute is omitted', () => {
    expect(serializeColumnOptions([])).toBeUndefined();
  });

  it('serializes bare string and number values', () => {
    expect(serializeColumnOptions(['admin', 'user'])).toBe('admin,user');
    expect(serializeColumnOptions([1, 2, 3])).toBe('1,2,3');
  });

  it('serializes label/value pairs as value:label', () => {
    expect(
      serializeColumnOptions([
        { label: 'Administrator', value: 'admin' },
        { label: 'User', value: 'user' },
      ]),
    ).toBe('admin:Administrator,user:User');
  });

  it('omits a redundant label that equals the stringified value', () => {
    expect(serializeColumnOptions([{ label: 'admin', value: 'admin' }])).toBe('admin');
    expect(serializeColumnOptions([{ label: '1', value: 1 }])).toBe('1');
  });

  it('warns when a value or label contains a separator character', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    serializeColumnOptions([{ label: 'Admin, Super', value: 'admin' }]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Admin, Super'));

    warn.mockClear();
    serializeColumnOptions(['a:b']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('a:b'));

    warn.mockClear();
    serializeColumnOptions(['admin', { label: 'User', value: 'user' }]);
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it('round-trips through the core parser grammar', () => {
    const serialized = serializeColumnOptions([
      { label: 'Administrator', value: 'admin' },
      { label: 'user', value: 'user' },
    ]);

    expect(parseOptionsAttr(serialized!)).toEqual([
      { value: 'admin', label: 'Administrator' },
      { value: 'user', label: 'user' },
    ]);
  });
});
