/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _clearAllDragSessions,
  clearDragSession,
  lookupDragSession,
  newDragSessionId,
  registerDragSession,
} from '../../core/internal/drag-drop-registry';
import {
  TBW_ROW_DRAG_MIME,
  clearCurrentDragSession,
  computeDropPosition,
  createAutoScroller,
  decodePayload,
  encodePayload,
  findMatchingZoneMime,
  formatRowsAsTSV,
  getCurrentDragSession,
  hasAnyRowDragMime,
  mimeForZone,
  parseZoneFromMime,
  setCurrentDragSession,
} from './drag-drop-protocol';

beforeEach(() => {
  _clearAllDragSessions();
  clearCurrentDragSession();
});

describe('drag-drop-protocol — MIME', () => {
  it('mimeForZone tags the base MIME with a URL-encoded zone', () => {
    expect(mimeForZone('tasks')).toBe(`${TBW_ROW_DRAG_MIME};zone=tasks`);
    expect(mimeForZone('a b')).toContain('zone=a%20b');
  });

  it('parseZoneFromMime round-trips', () => {
    expect(parseZoneFromMime(mimeForZone('tasks'))).toBe('tasks');
    expect(parseZoneFromMime(mimeForZone('a b'))).toBe('a b');
    expect(parseZoneFromMime('text/plain')).toBeNull();
  });

  it('findMatchingZoneMime returns the matching tagged MIME', () => {
    const types = ['text/plain', mimeForZone('tasks'), TBW_ROW_DRAG_MIME];
    expect(findMatchingZoneMime(types, 'tasks')).toBe(mimeForZone('tasks'));
    expect(findMatchingZoneMime(types, 'people')).toBeNull();
  });

  it('hasAnyRowDragMime detects the base or tagged MIME', () => {
    expect(hasAnyRowDragMime([TBW_ROW_DRAG_MIME])).toBe(true);
    expect(hasAnyRowDragMime([mimeForZone('z')])).toBe(true);
    expect(hasAnyRowDragMime(['text/plain'])).toBe(false);
  });
});

describe('drag-drop-protocol — payload codec', () => {
  it('encode/decode round-trip', () => {
    const payload = {
      sessionId: 'abc',
      sourceGridId: 'grid-1',
      dropZone: 'tasks',
      rows: [{ id: 1 }, { id: 2 }],
      rowIndices: [0, 1],
      operation: 'move' as const,
    };
    const encoded = encodePayload(payload);
    const decoded = decodePayload(encoded);
    expect(decoded).toEqual(payload);
  });

  it('decodePayload returns null for malformed JSON', () => {
    expect(decodePayload('')).toBeNull();
    expect(decodePayload('not-json')).toBeNull();
    expect(decodePayload('{}')).toBeNull();
  });

  it('decodePayload rejects bad operation values', () => {
    const bad = JSON.stringify({
      sessionId: 'a',
      sourceGridId: 'g',
      dropZone: 'z',
      rows: [],
      rowIndices: [],
      operation: 'invalid',
    });
    expect(decodePayload(bad)).toBeNull();
  });
});

describe('drag-drop-protocol — drop position', () => {
  function makeRow(top: number, height = 30): HTMLElement {
    const el = document.createElement('div');
    el.className = 'data-grid-row';
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('data-row', '1');
    el.appendChild(cell);
    el.getBoundingClientRect = () =>
      ({
        top,
        bottom: top + height,
        height,
        left: 0,
        right: 100,
        width: 100,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
    return el;
  }

  it('inserts BEFORE when cursor is above midpoint', () => {
    const row = makeRow(100, 30);
    const pos = computeDropPosition(row, 105, () => 5, 10);
    expect(pos.isBefore).toBe(true);
    expect(pos.insertIndex).toBe(5);
    expect(pos.overIndex).toBe(5);
  });

  it('inserts AFTER when cursor is below midpoint', () => {
    const row = makeRow(100, 30);
    const pos = computeDropPosition(row, 125, () => 5, 10);
    expect(pos.isBefore).toBe(false);
    expect(pos.insertIndex).toBe(6);
  });

  it('appends when no row is under cursor (empty area)', () => {
    const pos = computeDropPosition(null, 0, () => -1, 10);
    expect(pos.insertIndex).toBe(10);
    expect(pos.overIndex).toBeNull();
  });
});

describe('drag-drop-protocol — current session tracker', () => {
  it('set / get / clear', () => {
    const payload = {
      sessionId: 's1',
      sourceGridId: 'g',
      dropZone: 'z',
      rows: [],
      rowIndices: [],
      operation: 'move' as const,
    };
    setCurrentDragSession('s1', payload);
    expect(getCurrentDragSession()?.sessionId).toBe('s1');
    clearCurrentDragSession();
    expect(getCurrentDragSession()).toBeNull();
  });
});

describe('drag-drop-protocol — TSV fallback', () => {
  it('formats rows skipping utility columns', () => {
    const rows = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 40 },
    ];
    const cols = [
      { field: '__drag', utility: true },
      { field: 'name', header: 'Name' },
      { field: 'age', header: 'Age' },
    ];
    const tsv = formatRowsAsTSV(rows, cols as any);
    expect(tsv).toBe('Alice\t30\nBob\t40');
  });

  it('replaces tabs and newlines in cell values', () => {
    const tsv = formatRowsAsTSV([{ a: 'foo\tbar\nbaz' }], [{ field: 'a' }] as any);
    expect(tsv).toBe('foo bar baz');
  });
});

describe('drag-drop-registry', () => {
  it('round-trips object references via WeakRef', () => {
    const row = { id: 1 };
    registerDragSession('s', [row]);
    const recovered = lookupDragSession<typeof row>('s');
    expect(recovered?.[0]).toBe(row); // reference identity preserved
  });

  it('returns undefined for unknown sessions', () => {
    expect(lookupDragSession('does-not-exist')).toBeUndefined();
  });

  it('clearDragSession removes the session', () => {
    registerDragSession('s', [{ id: 1 }]);
    clearDragSession('s');
    expect(lookupDragSession('s')).toBeUndefined();
  });

  it('newDragSessionId produces unique strings', () => {
    const ids = new Set([newDragSessionId(), newDragSessionId(), newDragSessionId()]);
    expect(ids.size).toBe(3);
  });
});

describe('drag-drop-protocol — auto-scroller', () => {
  let viewport: HTMLElement;
  let rafCb: FrameRequestCallback | null = null;

  beforeEach(() => {
    viewport = document.createElement('div');
    Object.defineProperty(viewport, 'scrollTop', { value: 100, writable: true });
    viewport.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 200,
        left: 0,
        right: 100,
        height: 200,
        width: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    rafCb = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      rafCb = null;
    });
  });

  it('scrolls when pointer is near the top edge', () => {
    const onChange = vi.fn();
    const scroller = createAutoScroller(viewport, { edgeSize: 50, speed: 5, maxSpeed: 10 }, onChange);
    scroller.onPointerMove(20); // within 50px of top
    expect(rafCb).not.toBeNull();
    rafCb?.(performance.now());
    expect(viewport.scrollTop).toBeLessThan(100);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('scrolls down near the bottom edge', () => {
    const scroller = createAutoScroller(viewport, { edgeSize: 50, speed: 5, maxSpeed: 10 });
    scroller.onPointerMove(180); // within 50px of bottom (rect.bottom=200)
    rafCb?.(performance.now());
    expect(viewport.scrollTop).toBeGreaterThan(100);
  });

  it('does nothing when pointer is in the middle', () => {
    const scroller = createAutoScroller(viewport, { edgeSize: 50, speed: 5, maxSpeed: 10 });
    scroller.onPointerMove(100); // middle of 0..200
    rafCb?.(performance.now());
    expect(viewport.scrollTop).toBe(100);
  });

  it('stop() halts the loop', () => {
    const scroller = createAutoScroller(viewport, { edgeSize: 50, speed: 5, maxSpeed: 10 });
    scroller.onPointerMove(20);
    scroller.stop();
    expect(rafCb).toBeNull();
    expect(scroller.isScrolling).toBe(false);
  });
});
