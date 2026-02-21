/**
 * Event Bus & Query System Tests
 *
 * Tests for the plugin-to-plugin communication systems:
 * - Event Bus: on/off/emitPluginEvent for async notifications
 * - Query System: handleQuery/query for sync state retrieval
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseGridPlugin, type PluginManifest, type PluginQuery } from './base-plugin';
import { PluginManager } from './plugin-manager';
import type { GridElementRef } from './types';

// ============================================================================
// Test Fixtures
// ============================================================================

/** Mock grid element for testing */
function createMockGrid(): GridElementRef {
  return {
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
    gridConfig: {} as any,
    effectiveConfig: {} as any,
    getRowId: () => '1',
    getRow: () => undefined,
    updateRow: vi.fn(),
    updateRows: vi.fn(),
    requestRender: vi.fn(),
    requestRenderWithFocus: vi.fn(),
    requestAfterRender: vi.fn(),
    forceLayout: vi.fn(),
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
  } as unknown as GridElementRef;
}

/** Test plugin that emits events */
class EmitterPlugin extends BaseGridPlugin {
  static override readonly manifest: PluginManifest = {
    events: [
      { type: 'data-changed', description: 'Emitted when data changes' },
      { type: 'state-updated', description: 'Emitted when internal state updates' },
    ],
  };

  readonly name = 'emitter';

  // Expose protected methods for testing
  testEmitPluginEvent<T>(eventType: string, detail: T): void {
    this.emitPluginEvent(eventType, detail);
  }
}

/** Test plugin that subscribes to events */
class ListenerPlugin extends BaseGridPlugin {
  readonly name = 'listener';
  public receivedEvents: Array<{ type: string; detail: unknown }> = [];

  override attach(grid: GridElementRef): void {
    super.attach(grid);
    this.on('data-changed', (detail) => {
      this.receivedEvents.push({ type: 'data-changed', detail });
    });
  }

  // Expose protected methods for testing
  testOn<T>(eventType: string, callback: (detail: T) => void): void {
    this.on(eventType, callback);
  }

  testOff(eventType: string): void {
    this.off(eventType);
  }
}

/** Test plugin that handles queries */
class QueryHandlerPlugin extends BaseGridPlugin {
  static override readonly manifest: PluginManifest = {
    queries: [
      { type: 'get-count', description: 'Returns the current count' },
      { type: 'is-enabled', description: 'Returns whether feature is enabled' },
    ],
  };

  readonly name = 'queryHandler';
  private count = 42;
  private enabled = true;

  override handleQuery(query: PluginQuery): unknown {
    switch (query.type) {
      case 'get-count':
        return this.count;
      case 'is-enabled':
        return this.enabled;
      default:
        return undefined;
    }
  }

  setCount(value: number): void {
    this.count = value;
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
  }
}

/** Test plugin using legacy onPluginQuery */
class LegacyQueryPlugin extends BaseGridPlugin {
  readonly name = 'legacyQuery';
  private value = 'legacy';

  override onPluginQuery(query: PluginQuery): unknown {
    if (query.type === 'get-value') {
      return this.value;
    }
    return undefined;
  }
}

// ============================================================================
// Event Bus Tests
// ============================================================================

describe('Event Bus', () => {
  let mockGrid: GridElementRef;
  let pluginManager: PluginManager;

  beforeEach(() => {
    mockGrid = createMockGrid();
    pluginManager = new PluginManager(mockGrid as any);
    // Wire up the plugin manager reference
    (mockGrid as any)._pluginManager = pluginManager;
  });

  afterEach(() => {
    pluginManager.detachAll();
  });

  describe('subscribe and emit', () => {
    it('should deliver events to subscribers', () => {
      const emitter = new EmitterPlugin();
      const listener = new ListenerPlugin();

      pluginManager.attach(emitter);
      pluginManager.attach(listener);

      emitter.testEmitPluginEvent('data-changed', { field: 'name', value: 'Alice' });

      expect(listener.receivedEvents).toHaveLength(1);
      expect(listener.receivedEvents[0]).toEqual({
        type: 'data-changed',
        detail: { field: 'name', value: 'Alice' },
      });
    });

    it('should deliver events to multiple subscribers', () => {
      const emitter = new EmitterPlugin();
      const listener1 = new ListenerPlugin();
      const listener2 = new ListenerPlugin();

      pluginManager.attach(emitter);
      pluginManager.attach(listener1);
      pluginManager.attach(listener2);

      // Both listeners subscribe to data-changed during attach
      emitter.testEmitPluginEvent('data-changed', { count: 5 });

      expect(listener1.receivedEvents).toHaveLength(1);
      expect(listener2.receivedEvents).toHaveLength(1);
    });

    it('should not deliver events to unsubscribed plugins', () => {
      const emitter = new EmitterPlugin();
      const listener = new ListenerPlugin();

      pluginManager.attach(emitter);
      pluginManager.attach(listener);

      // Unsubscribe
      listener.testOff('data-changed');

      emitter.testEmitPluginEvent('data-changed', { test: true });

      expect(listener.receivedEvents).toHaveLength(0);
    });

    it('should handle events with no subscribers gracefully', () => {
      const emitter = new EmitterPlugin();
      pluginManager.attach(emitter);

      // Should not throw
      expect(() => {
        emitter.testEmitPluginEvent('data-changed', { test: true });
      }).not.toThrow();
    });
  });

  describe('unsubscribe', () => {
    it('should remove specific event subscription', () => {
      const emitter = new EmitterPlugin();
      const listener = new ListenerPlugin();

      pluginManager.attach(emitter);
      pluginManager.attach(listener);

      // Subscribe to another event
      listener.testOn('state-updated', () => {
        listener.receivedEvents.push({ type: 'state-updated', detail: null });
      });

      // Unsubscribe from data-changed only
      listener.testOff('data-changed');

      emitter.testEmitPluginEvent('data-changed', { test: true });
      emitter.testEmitPluginEvent('state-updated', null);

      // Should only receive state-updated
      expect(listener.receivedEvents).toHaveLength(1);
      expect(listener.receivedEvents[0].type).toBe('state-updated');
    });
  });

  describe('auto-cleanup on detach', () => {
    it('should remove all subscriptions when plugin is detached', () => {
      const emitter = new EmitterPlugin();
      const listener = new ListenerPlugin();

      pluginManager.attach(emitter);
      pluginManager.attach(listener);

      // Manually detach listener (simulating plugin removal)
      pluginManager.detachAll();

      // Re-attach only emitter with a fresh manager
      const newManager = new PluginManager(mockGrid as any);
      (mockGrid as any)._pluginManager = newManager;
      newManager.attach(emitter);

      // Should not throw when emitting (no listeners)
      expect(() => {
        emitter.testEmitPluginEvent('data-changed', { test: true });
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should catch and log errors in event handlers', () => {
      const emitter = new EmitterPlugin();
      const listener = new ListenerPlugin();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      pluginManager.attach(emitter);
      pluginManager.attach(listener);

      // Subscribe with a handler that throws
      listener.testOn('error-event', () => {
        throw new Error('Handler error');
      });

      // Should not throw, but should log
      expect(() => {
        emitter.testEmitPluginEvent('error-event', {});
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in plugin event handler'),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });
});

// ============================================================================
// Query System Tests
// ============================================================================

describe('Query System', () => {
  let mockGrid: GridElementRef;
  let pluginManager: PluginManager;

  beforeEach(() => {
    mockGrid = createMockGrid();
    pluginManager = new PluginManager(mockGrid as any);
  });

  afterEach(() => {
    pluginManager.detachAll();
  });

  describe('handleQuery (new API)', () => {
    it('should collect responses from plugins with handleQuery', () => {
      const handler = new QueryHandlerPlugin();
      pluginManager.attach(handler);

      const responses = pluginManager.queryPlugins<number>({ type: 'get-count', context: null });

      expect(responses).toEqual([42]);
    });

    it('should return undefined responses filtered out', () => {
      const handler = new QueryHandlerPlugin();
      pluginManager.attach(handler);

      const responses = pluginManager.queryPlugins<string>({ type: 'unknown-query', context: null });

      expect(responses).toEqual([]);
    });

    it('should collect responses from multiple plugins', () => {
      const handler1 = new QueryHandlerPlugin();
      const handler2 = new QueryHandlerPlugin();
      handler2.setCount(100);

      pluginManager.attach(handler1);
      pluginManager.attach(handler2);

      const responses = pluginManager.queryPlugins<number>({ type: 'get-count', context: null });

      expect(responses).toEqual([42, 100]);
    });
  });

  describe('onPluginQuery (legacy API)', () => {
    it('should still work with onPluginQuery for backwards compatibility', () => {
      const legacy = new LegacyQueryPlugin();
      pluginManager.attach(legacy);

      const responses = pluginManager.queryPlugins<string>({ type: 'get-value', context: null });

      expect(responses).toEqual(['legacy']);
    });

    it('should prefer handleQuery over onPluginQuery when both are defined', () => {
      // Create a plugin with both methods
      class BothMethodsPlugin extends BaseGridPlugin {
        readonly name = 'both';

        override handleQuery(query: PluginQuery): unknown {
          if (query.type === 'test') return 'handleQuery';
          return undefined;
        }

        override onPluginQuery(query: PluginQuery): unknown {
          if (query.type === 'test') return 'onPluginQuery';
          return undefined;
        }
      }

      const both = new BothMethodsPlugin();
      pluginManager.attach(both);

      const responses = pluginManager.queryPlugins<string>({ type: 'test', context: null });

      // handleQuery should take precedence
      expect(responses).toEqual(['handleQuery']);
    });
  });

  describe('manifest.queries declaration', () => {
    it('should have queries declared in manifest', () => {
      const manifest = QueryHandlerPlugin.manifest;

      expect(manifest?.queries).toBeDefined();
      expect(manifest?.queries).toHaveLength(2);
      expect(manifest?.queries?.[0].type).toBe('get-count');
      expect(manifest?.queries?.[1].type).toBe('is-enabled');
    });
  });
});
