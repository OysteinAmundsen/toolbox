/**
 * pointer-modality — unit tests
 *
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPrimaryPointer, onPointerModalityChange, type PointerModality } from './pointer-modality';

// #region Helpers

/** Build a minimal fake MediaQueryList that matches the given value. */
function makeFakeMql(matches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches,
    media: '(pointer: coarse)',
    addEventListener: vi.fn((_type: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    }),
    removeEventListener: vi.fn((_type: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.delete(cb);
    }),
    // Simulate a query-change (used by tests to fire the shared handler)
    _fire(newMatches: boolean) {
      mql.matches = newMatches;
      const evt = { matches: newMatches, media: mql.media } as MediaQueryListEvent;
      listeners.forEach((cb) => cb(evt));
    },
  };
  return mql;
}

type FakeMql = ReturnType<typeof makeFakeMql>;

// #endregion

// ─────────────────────────────────────────────────────────────────────────────
// Each test suite resets module state by re-importing via vi.isolateModules.
// Because the module holds singleton state (_mql, _subscribers), we must
// reload it fresh in every describe block that installs a different matchMedia.
// ─────────────────────────────────────────────────────────────────────────────

describe('pointer-modality', () => {
  // #region coarse detection

  describe('getPrimaryPointer — coarse device', () => {
    let fakeMql: FakeMql;
    let getPrimary: typeof getPrimaryPointer;

    beforeEach(async () => {
      fakeMql = makeFakeMql(true); // pointer: coarse
      globalThis.matchMedia = vi.fn(() => fakeMql) as any;
      const mod = await import('./pointer-modality?t=coarse');
      getPrimary = mod.getPrimaryPointer;
    });

    afterEach(() => {
      vi.resetModules();
    });

    it('returns coarse when matchMedia matches', () => {
      expect(getPrimary()).toBe<PointerModality>('coarse');
    });
  });

  // #endregion

  // #region fine detection

  describe('getPrimaryPointer — fine device', () => {
    let fakeMql: FakeMql;
    let getPrimary: typeof getPrimaryPointer;

    beforeEach(async () => {
      fakeMql = makeFakeMql(false); // pointer: fine
      globalThis.matchMedia = vi.fn(() => fakeMql) as any;
      const mod = await import('./pointer-modality?t=fine');
      getPrimary = mod.getPrimaryPointer;
    });

    afterEach(() => {
      vi.resetModules();
    });

    it('returns fine when matchMedia does not match', () => {
      expect(getPrimary()).toBe<PointerModality>('fine');
    });
  });

  // #endregion

  // #region change subscription fires

  describe('onPointerModalityChange — subscription', () => {
    let fakeMql: FakeMql;
    let getPrimary: typeof getPrimaryPointer;
    let subscribe: typeof onPointerModalityChange;

    beforeEach(async () => {
      fakeMql = makeFakeMql(false); // start as fine
      globalThis.matchMedia = vi.fn(() => fakeMql) as any;
      const mod = await import('./pointer-modality?t=subscribe');
      getPrimary = mod.getPrimaryPointer;
      subscribe = mod.onPointerModalityChange;
    });

    afterEach(() => {
      vi.resetModules();
    });

    it('callback fires with new modality when query changes', () => {
      const received: PointerModality[] = [];
      subscribe((m) => received.push(m));

      // Initially fine
      expect(getPrimary()).toBe('fine');

      // Switch to coarse
      fakeMql._fire(true);
      expect(received).toEqual(['coarse']);

      // Switch back to fine
      fakeMql._fire(false);
      expect(received).toEqual(['coarse', 'fine']);
    });
  });

  // #endregion

  // #region unsubscribe stops firing

  describe('onPointerModalityChange — unsubscribe', () => {
    let fakeMql: FakeMql;
    let subscribe: typeof onPointerModalityChange;

    beforeEach(async () => {
      fakeMql = makeFakeMql(false);
      globalThis.matchMedia = vi.fn(() => fakeMql) as any;
      const mod = await import('./pointer-modality?t=unsub');
      subscribe = mod.onPointerModalityChange;
    });

    afterEach(() => {
      vi.resetModules();
    });

    it('callback no longer fires after unsubscribe', () => {
      const received: PointerModality[] = [];
      const unsub = subscribe((m) => received.push(m));

      fakeMql._fire(true);
      expect(received).toHaveLength(1);

      unsub();
      fakeMql._fire(false);
      // Still only 1 item — callback stopped
      expect(received).toHaveLength(1);
    });

    it('unsubscribe is idempotent — calling twice is safe', () => {
      const unsub = subscribe(vi.fn());
      expect(() => {
        unsub();
        unsub();
      }).not.toThrow();
    });
  });

  // #endregion

  // #region no-matchMedia fallback

  describe('getPrimaryPointer — no matchMedia (SSR / happy-dom fallback)', () => {
    let getPrimary: typeof getPrimaryPointer;
    let subscribe: typeof onPointerModalityChange;

    let original: typeof globalThis.matchMedia;

    beforeEach(async () => {
      // Remove matchMedia entirely to simulate SSR. `_getMql()` reads
      // `globalThis.matchMedia` lazily on every call, so it must stay absent
      // for the duration of each test — restoring it here would make these
      // assertions pass without ever touching the fallback path.
      original = globalThis.matchMedia;
      // @ts-expect-error intentional for SSR simulation
      delete globalThis.matchMedia;
      const mod = await import('./pointer-modality?t=ssr');
      getPrimary = mod.getPrimaryPointer;
      subscribe = mod.onPointerModalityChange;
    });

    afterEach(() => {
      globalThis.matchMedia = original;
      vi.resetModules();
    });

    it('returns fine as the safe default', () => {
      expect(getPrimary()).toBe<PointerModality>('fine');
    });

    it('subscribe returns a no-op unsubscribe and never throws', () => {
      const received: PointerModality[] = [];
      const unsub = subscribe((m) => received.push(m));
      expect(() => unsub()).not.toThrow();
      expect(received).toHaveLength(0);
    });
  });

  // #endregion
});
