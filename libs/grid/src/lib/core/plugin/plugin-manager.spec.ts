/**
 * Plugin Manager – hookPriority Tests
 *
 * Verifies that manifest.hookPriority controls the execution order
 * of hooks across plugins, overriding the default array order.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseGridPlugin, type PluginManifest } from './base-plugin';
import { PluginManager } from './plugin-manager';
import type { GridElementRef } from './types';

// #region Test Fixtures

function createMockGrid(): GridElementRef {
  const mock: Partial<GridElementRef> = {
    clientWidth: 800,
    clientHeight: 600,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    rows: [],
    columns: [],
    sourceRows: [],
    _columns: [],
    _visibleColumns: [],
    _focusRow: 0,
    _focusCol: 0,
    disconnectSignal: new AbortController().signal,
    gridConfig: {} as GridElementRef['gridConfig'],
    effectiveConfig: {} as GridElementRef['effectiveConfig'],
    getRowId: () => '1',
    getRow: () => undefined,
    updateRow: vi.fn(),
    updateRows: vi.fn(),
    requestRender: vi.fn(),
    requestRenderWithFocus: vi.fn(),
    requestAfterRender: vi.fn(),
    forceLayout: vi.fn() as unknown as GridElementRef['forceLayout'],
    dispatchEvent: vi.fn(),
    queryPlugins: vi.fn(() => []),
    query: vi.fn(() => []),
    findRenderedRowElement: () => null,
    getAllColumns: () => [],
    showColumn: vi.fn(),
    hideColumn: vi.fn(),
    toggleColumn: vi.fn(),
    isColumnVisible: () => true,
    setColumnVisibility: vi.fn(),
    getPlugin: vi.fn(),
    hasPlugin: vi.fn(() => false),
    registerToolPanel: vi.fn(),
    unregisterToolPanel: vi.fn(),
    getToolPanels: () => [],
    _pluginManager: undefined,
  };
  return mock as GridElementRef;
}

/** Tracks the order in which plugins execute hooks */
const executionOrder: string[] = [];

class PluginA extends BaseGridPlugin {
  readonly name = 'pluginA';
  override processRows(rows: any[]): any[] {
    executionOrder.push('A');
    return rows;
  }
  override afterRender(): void {
    executionOrder.push('A');
  }
  override onKeyDown(_event: KeyboardEvent): boolean {
    executionOrder.push('A');
    return false;
  }
}

class PluginB extends BaseGridPlugin {
  readonly name = 'pluginB';
  override processRows(rows: any[]): any[] {
    executionOrder.push('B');
    return rows;
  }
  override afterRender(): void {
    executionOrder.push('B');
  }
  override onKeyDown(_event: KeyboardEvent): boolean {
    executionOrder.push('B');
    return false;
  }
}

class PluginC extends BaseGridPlugin {
  readonly name = 'pluginC';
  override processRows(rows: any[]): any[] {
    executionOrder.push('C');
    return rows;
  }
  override afterRender(): void {
    executionOrder.push('C');
  }
}

/** Plugin with high priority (runs later) */
class HighPriorityPlugin extends BaseGridPlugin {
  static override readonly manifest: PluginManifest = {
    hookPriority: { processRows: 100, afterRender: 100, onKeyDown: 100 },
  };
  readonly name = 'highPriority';
  override processRows(rows: any[]): any[] {
    executionOrder.push('high');
    return rows;
  }
  override afterRender(): void {
    executionOrder.push('high');
  }
  override onKeyDown(_event: KeyboardEvent): boolean {
    executionOrder.push('high');
    return false;
  }
}

/** Plugin with low (negative) priority (runs earlier) */
class LowPriorityPlugin extends BaseGridPlugin {
  static override readonly manifest: PluginManifest = {
    hookPriority: { processRows: -50, afterRender: -50, onKeyDown: -50 },
  };
  readonly name = 'lowPriority';
  override processRows(rows: any[]): any[] {
    executionOrder.push('low');
    return rows;
  }
  override afterRender(): void {
    executionOrder.push('low');
  }
  override onKeyDown(_event: KeyboardEvent): boolean {
    executionOrder.push('low');
    return false;
  }
}

/** Plugin with per-hook priorities */
class MixedPriorityPlugin extends BaseGridPlugin {
  static override readonly manifest: PluginManifest = {
    hookPriority: { processRows: 50, afterRender: -50 },
  };
  readonly name = 'mixedPriority';
  override processRows(rows: any[]): any[] {
    executionOrder.push('mixed');
    return rows;
  }
  override afterRender(): void {
    executionOrder.push('mixed');
  }
}

// #endregion

describe('PluginManager hookPriority', () => {
  let grid: GridElementRef;
  let manager: PluginManager;

  beforeEach(() => {
    grid = createMockGrid();
    manager = new PluginManager(grid);
    executionOrder.length = 0;
  });

  afterEach(() => {
    manager.detachAll();
  });

  describe('default behavior (no hookPriority)', () => {
    it('should execute hooks in plugin array order', () => {
      manager.attachAll([new PluginA(), new PluginB(), new PluginC()]);
      manager.processRows([]);
      expect(executionOrder).toEqual(['A', 'B', 'C']);
    });

    it('should preserve array order for afterRender', () => {
      manager.attachAll([new PluginC(), new PluginA(), new PluginB()]);
      manager.afterRender();
      expect(executionOrder).toEqual(['C', 'A', 'B']);
    });
  });

  describe('hookPriority sorting', () => {
    it('should run lower priority values before higher ones', () => {
      // Attached in order: high, low — but low (-50) should run before high (100)
      manager.attachAll([new HighPriorityPlugin(), new LowPriorityPlugin()]);
      manager.processRows([]);
      expect(executionOrder).toEqual(['low', 'high']);
    });

    it('should sort plugins without priority as 0', () => {
      // PluginA (no manifest → priority 0) should run between low (-50) and high (100)
      manager.attachAll([new HighPriorityPlugin(), new PluginA(), new LowPriorityPlugin()]);
      manager.processRows([]);
      expect(executionOrder).toEqual(['low', 'A', 'high']);
    });

    it('should apply priority independently per hook', () => {
      // MixedPriority: processRows=50, afterRender=-50
      // PluginA: no priority (0)
      manager.attachAll([new MixedPriorityPlugin(), new PluginA()]);

      manager.processRows([]);
      expect(executionOrder).toEqual(['A', 'mixed']); // 0 < 50

      executionOrder.length = 0;
      manager.afterRender();
      expect(executionOrder).toEqual(['mixed', 'A']); // -50 < 0
    });

    it('should preserve array order for equal priorities', () => {
      // All three have default priority 0 — array order should be preserved
      manager.attachAll([new PluginC(), new PluginA(), new PluginB()]);
      manager.processRows([]);
      expect(executionOrder).toEqual(['C', 'A', 'B']);
    });

    it('should work with event hooks that return boolean', () => {
      manager.attachAll([new HighPriorityPlugin(), new LowPriorityPlugin()]);
      const event = { key: 'Enter' } as KeyboardEvent;
      manager.onKeyDown(event);
      expect(executionOrder).toEqual(['low', 'high']);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate cache when a new plugin is attached', () => {
      manager.attachAll([new HighPriorityPlugin()]);
      manager.processRows([]);
      expect(executionOrder).toEqual(['high']);

      executionOrder.length = 0;
      manager.attach(new LowPriorityPlugin());
      manager.processRows([]);
      expect(executionOrder).toEqual(['low', 'high']);
    });

    it('should invalidate cache on detachAll', () => {
      manager.attachAll([new HighPriorityPlugin(), new LowPriorityPlugin()]);
      manager.processRows([]);
      expect(executionOrder).toEqual(['low', 'high']);

      executionOrder.length = 0;
      manager.detachAll();

      // After detaching all, attaching in new order should work
      manager.attachAll([new LowPriorityPlugin(), new HighPriorityPlugin()]);
      manager.processRows([]);
      expect(executionOrder).toEqual(['low', 'high']);
    });
  });

  describe('hook filtering', () => {
    it('should only invoke plugins that implement the hook', () => {
      // PluginA has processRows, PluginB has processRows, but a plugin without it should be skipped
      class NoHooksPlugin extends BaseGridPlugin {
        readonly name = 'noHooks';
      }
      manager.attachAll([new PluginA(), new NoHooksPlugin(), new PluginB()]);
      manager.processRows([]);
      expect(executionOrder).toEqual(['A', 'B']);
    });
  });
});
