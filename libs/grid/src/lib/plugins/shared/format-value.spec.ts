import { describe, expect, it, vi } from 'vitest';
import { tryFormat } from './format-value';

describe('tryFormat', () => {
  it('passes value and row through and stringifies the result', () => {
    const format = vi.fn((value: unknown, row: { unit: string }) => `${value} ${row.unit}`);
    expect(tryFormat(format, 3, { unit: 'kg' }, vi.fn())).toBe('3 kg');
    expect(format).toHaveBeenCalledWith(3, { unit: 'kg' });
  });

  it('returns an empty string for a nullish result', () => {
    expect(tryFormat(() => null, 1, undefined, vi.fn())).toBe('');
  });

  it('returns undefined and reports the error when format throws', () => {
    const onError = vi.fn();
    const format = (value: unknown, row: { unit: string }) => `${value} ${row.unit}`;
    expect(tryFormat(format, 3, undefined, onError)).toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.any(TypeError));
  });
});
