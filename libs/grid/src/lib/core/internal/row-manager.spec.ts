import { describe, expect, it, vi } from 'vitest';
import { resolveRowIdOrThrow, tryResolveRowId } from './row-manager';

describe('tryResolveRowId', () => {
  it('uses the configured getRowId', () => {
    expect(tryResolveRowId({ uuid: 'a' }, (r: { uuid: string }) => r.uuid)).toBe('a');
  });

  it('falls back to id / _id', () => {
    expect(tryResolveRowId({ id: 7 })).toBe('7');
    expect(tryResolveRowId({ _id: 'x' })).toBe('x');
    expect(tryResolveRowId({ name: 'none' })).toBeUndefined();
  });

  describe('loading placeholders (#508)', () => {
    it('gives a ServerSide placeholder a stable internal id without calling getRowId', () => {
      const getRowId = vi.fn((r: { id: number }) => String(r.id));
      expect(tryResolveRowId({ __loading: true, __index: 42 } as never, getRowId)).toBe('__loading:42');
      expect(getRowId).not.toHaveBeenCalled();
    });

    it('gives a grouped placeholder an id derived from its group key', () => {
      expect(tryResolveRowId({ __loading: true, __groupKey: 'dept=Sales' })).toBe('__loading:group:dept=Sales');
    });

    it('returns undefined for a placeholder with no index or group key', () => {
      const getRowId = vi.fn();
      expect(tryResolveRowId({ __loading: true }, getRowId)).toBeUndefined();
      expect(getRowId).not.toHaveBeenCalled();
    });

    it('resolveRowIdOrThrow returns the placeholder id', () => {
      expect(resolveRowIdOrThrow({ __loading: true, __index: 3 }, 'grid')).toBe('__loading:3');
    });
  });
});
