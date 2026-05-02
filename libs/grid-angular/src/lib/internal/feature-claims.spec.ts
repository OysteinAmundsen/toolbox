/**
 * Tests for the per-grid feature/event claims registry.
 *
 * The registry is framework-free, so we exercise it directly without any
 * `@angular/core` mocking. Behaviour we lock in:
 *
 *  - feature claims store and return a config-getter scoped to a grid element
 *  - claims do not bleed between grid elements
 *  - unregister removes the claim cleanly
 *  - event claims are independent of feature claims
 */
import { describe, expect, it } from 'vitest';
import {
  claimEvent,
  getFeatureClaim,
  isEventClaimed,
  registerFeatureClaim,
  unclaimEvent,
  unregisterFeatureClaim,
} from './feature-claims';

describe('feature-claims registry', () => {
  describe('feature claims', () => {
    it('returns undefined for an unclaimed feature', () => {
      const grid = document.createElement('tbw-grid');
      expect(getFeatureClaim(grid, 'filtering')).toBeUndefined();
    });

    it('stores and retrieves a config-getter per grid element', () => {
      const grid = document.createElement('tbw-grid');
      const getter = () => ({ debounceMs: 200 });
      registerFeatureClaim(grid, 'filtering', getter);

      const claim = getFeatureClaim(grid, 'filtering');
      expect(claim).toBe(getter);
      expect(claim?.()).toEqual({ debounceMs: 200 });
    });

    it('isolates claims between grid elements', () => {
      const gridA = document.createElement('tbw-grid');
      const gridB = document.createElement('tbw-grid');
      registerFeatureClaim(gridA, 'filtering', () => true);

      expect(getFeatureClaim(gridA, 'filtering')).toBeDefined();
      expect(getFeatureClaim(gridB, 'filtering')).toBeUndefined();
    });

    it('unregisterFeatureClaim removes a single claim without affecting others', () => {
      const grid = document.createElement('tbw-grid');
      registerFeatureClaim(grid, 'filtering', () => true);
      registerFeatureClaim(grid, 'multiSort', () => true);

      unregisterFeatureClaim(grid, 'filtering');

      expect(getFeatureClaim(grid, 'filtering')).toBeUndefined();
      expect(getFeatureClaim(grid, 'multiSort')).toBeDefined();
    });

    it('unregisterFeatureClaim is a no-op when the claim was never set', () => {
      const grid = document.createElement('tbw-grid');
      expect(() => unregisterFeatureClaim(grid, 'filtering')).not.toThrow();
    });

    it('replacing a claim returns the most recent getter (last write wins)', () => {
      const grid = document.createElement('tbw-grid');
      registerFeatureClaim(grid, 'filtering', () => 'first');
      registerFeatureClaim(grid, 'filtering', () => 'second');

      expect(getFeatureClaim(grid, 'filtering')?.()).toBe('second');
    });
  });

  describe('event claims', () => {
    it('returns false for an unclaimed event', () => {
      const grid = document.createElement('tbw-grid');
      expect(isEventClaimed(grid, 'filter-change')).toBe(false);
    });

    it('claims and reports an event per grid element', () => {
      const grid = document.createElement('tbw-grid');
      claimEvent(grid, 'filter-change');

      expect(isEventClaimed(grid, 'filter-change')).toBe(true);
      expect(isEventClaimed(grid, 'sort-change')).toBe(false);
    });

    it('isolates event claims between grid elements', () => {
      const gridA = document.createElement('tbw-grid');
      const gridB = document.createElement('tbw-grid');
      claimEvent(gridA, 'filter-change');

      expect(isEventClaimed(gridA, 'filter-change')).toBe(true);
      expect(isEventClaimed(gridB, 'filter-change')).toBe(false);
    });

    it('unclaimEvent releases ownership without affecting siblings', () => {
      const grid = document.createElement('tbw-grid');
      claimEvent(grid, 'filter-change');
      claimEvent(grid, 'sort-change');

      unclaimEvent(grid, 'filter-change');

      expect(isEventClaimed(grid, 'filter-change')).toBe(false);
      expect(isEventClaimed(grid, 'sort-change')).toBe(true);
    });

    it('unclaimEvent is a no-op when the event was never claimed', () => {
      const grid = document.createElement('tbw-grid');
      expect(() => unclaimEvent(grid, 'filter-change')).not.toThrow();
    });
  });
});
