/**
 * Tests for PortalManager — the React component that manages portals
 * for context-preserving cell rendering.
 *
 * @vitest-environment happy-dom
 */
import React, { act, createContext, useContext, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PortalManager, type PortalManagerHandle } from './portal-manager';

beforeAll(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

/**
 * Flush pending microtasks (portal batching uses queueMicrotask).
 * Must be called inside `act()` so React also processes the resulting state updates.
 */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
}

describe('PortalManager', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mountPortalManager(): { handle: PortalManagerHandle; unmount: () => void } {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    let resolvedHandle: PortalManagerHandle | null = null;

    function Wrapper() {
      const ref = useRef<PortalManagerHandle>(null);
      // Expose handle once mounted
      React.useEffect(() => {
        resolvedHandle = ref.current;
      });
      return <PortalManager ref={ref} />;
    }

    act(() => {
      root.render(<Wrapper />);
    });

    if (!resolvedHandle) {
      throw new Error('PortalManager handle not available after mount');
    }

    return {
      handle: resolvedHandle,
      unmount: () => {
        act(() => root.unmount());
      },
    };
  }

  it('should expose renderPortal, removePortal, and clear methods', () => {
    const { handle, unmount } = mountPortalManager();

    expect(typeof handle.renderPortal).toBe('function');
    expect(typeof handle.removePortal).toBe('function');
    expect(typeof handle.clear).toBe('function');

    unmount();
  });

  it('should render a portal into a container', async () => {
    const { handle, unmount } = mountPortalManager();

    const target = document.createElement('div');
    document.body.appendChild(target);

    await act(async () => {
      handle.renderPortal('test-key', target, React.createElement('span', null, 'Portal Content'));
      await flushMicrotasks();
    });

    expect(target.textContent).toBe('Portal Content');

    unmount();
  });

  it('should update portal content when called with the same key', async () => {
    const { handle, unmount } = mountPortalManager();

    const target = document.createElement('div');
    document.body.appendChild(target);

    await act(async () => {
      handle.renderPortal('update-key', target, React.createElement('span', null, 'First'));
      await flushMicrotasks();
    });
    expect(target.textContent).toBe('First');

    await act(async () => {
      handle.renderPortal('update-key', target, React.createElement('span', null, 'Second'));
      await flushMicrotasks();
    });
    expect(target.textContent).toBe('Second');

    unmount();
  });

  it('should remove a portal by key', async () => {
    const { handle, unmount } = mountPortalManager();

    const target = document.createElement('div');
    document.body.appendChild(target);

    await act(async () => {
      handle.renderPortal('remove-key', target, React.createElement('span', null, 'To Remove'));
      await flushMicrotasks();
    });
    expect(target.textContent).toBe('To Remove');

    await act(async () => {
      handle.removePortal('remove-key');
      await flushMicrotasks();
    });
    expect(target.textContent).toBe('');

    unmount();
  });

  it('should remove a portal synchronously when sync=true', async () => {
    const { handle, unmount } = mountPortalManager();

    const target = document.createElement('div');
    document.body.appendChild(target);

    await act(async () => {
      handle.renderPortal('sync-key', target, React.createElement('span', null, 'Panel Content'));
      await flushMicrotasks();
    });
    expect(target.textContent).toBe('Panel Content');

    // Sync removal: React must fully unmount before innerHTML is cleared.
    // This mirrors the tool panel accordion collapse flow where shell.ts
    // calls cleanup() then contentArea.innerHTML = ''.
    act(() => {
      handle.removePortal('sync-key', true);
    });
    // Content is gone immediately (no microtask needed)
    expect(target.textContent).toBe('');

    // Clearing the container after sync removal must NOT throw
    target.innerHTML = '';

    unmount();
  });

  it('should clear all portals', async () => {
    const { handle, unmount } = mountPortalManager();

    const target1 = document.createElement('div');
    const target2 = document.createElement('div');
    document.body.appendChild(target1);
    document.body.appendChild(target2);

    await act(async () => {
      handle.renderPortal('key1', target1, React.createElement('span', null, 'One'));
      handle.renderPortal('key2', target2, React.createElement('span', null, 'Two'));
      await flushMicrotasks();
    });

    expect(target1.textContent).toBe('One');
    expect(target2.textContent).toBe('Two');

    await act(async () => {
      handle.clear();
      await flushMicrotasks();
    });

    expect(target1.textContent).toBe('');
    expect(target2.textContent).toBe('');

    unmount();
  });

  it('should handle removing a non-existent key gracefully', () => {
    const { handle, unmount } = mountPortalManager();

    expect(() => {
      handle.removePortal('non-existent');
    }).not.toThrow();

    unmount();
  });

  it('should manage multiple portals simultaneously', async () => {
    const { handle, unmount } = mountPortalManager();

    const targets = Array.from({ length: 5 }, () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      return el;
    });

    await act(async () => {
      targets.forEach((target, i) => {
        handle.renderPortal(`multi-${i}`, target, React.createElement('span', null, `Item ${i}`));
      });
      await flushMicrotasks();
    });

    targets.forEach((target, i) => {
      expect(target.textContent).toBe(`Item ${i}`);
    });

    // Remove middle one
    await act(async () => {
      handle.removePortal('multi-2');
      await flushMicrotasks();
    });

    expect(targets[2].textContent).toBe('');
    expect(targets[0].textContent).toBe('Item 0');
    expect(targets[4].textContent).toBe('Item 4');

    unmount();
  });

  it('should batch multiple renderPortal calls into one flush', async () => {
    const { handle, unmount } = mountPortalManager();

    const targets = Array.from({ length: 3 }, () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      return el;
    });

    // All three calls should be coalesced into one microtask flush
    await act(async () => {
      handle.renderPortal('batch-0', targets[0], React.createElement('span', null, 'A'));
      handle.renderPortal('batch-1', targets[1], React.createElement('span', null, 'B'));
      handle.renderPortal('batch-2', targets[2], React.createElement('span', null, 'C'));
      await flushMicrotasks();
    });

    expect(targets[0].textContent).toBe('A');
    expect(targets[1].textContent).toBe('B');
    expect(targets[2].textContent).toBe('C');

    unmount();
  });

  it('should preserve React context through portals', async () => {
    const TestContext = createContext('default');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    let resolvedHandle: PortalManagerHandle | null = null;

    function ContextConsumer() {
      const value = useContext(TestContext);
      return React.createElement('span', { 'data-testid': 'value' }, value);
    }

    function Wrapper() {
      const ref = useRef<PortalManagerHandle>(null);
      React.useEffect(() => {
        resolvedHandle = ref.current;
      });
      return React.createElement(
        TestContext.Provider,
        { value: 'provided-value' },
        React.createElement(PortalManager, { ref }),
      );
    }

    act(() => {
      root.render(React.createElement(Wrapper));
    });

    const target = document.createElement('div');
    document.body.appendChild(target);

    await act(async () => {
      resolvedHandle!.renderPortal('context-test', target, React.createElement(ContextConsumer));
      await flushMicrotasks();
    });

    // The portal should inherit the context value from the parent tree
    expect(target.textContent).toBe('provided-value');

    act(() => root.unmount());
  });

  it('should prune portals whose containers are disconnected from DOM', async () => {
    const { handle, unmount } = mountPortalManager();

    const target = document.createElement('div');
    document.body.appendChild(target);

    await act(async () => {
      handle.renderPortal('prune-key', target, React.createElement('span', null, 'Prune Me'));
      await flushMicrotasks();
    });
    expect(target.textContent).toBe('Prune Me');

    // Disconnect the container from the DOM (simulates grid shrinking row pool)
    target.remove();

    // Prune runs after rAF — simulate that
    await act(async () => {
      // Trigger another render to schedule the prune
      const target2 = document.createElement('div');
      document.body.appendChild(target2);
      handle.renderPortal('still-alive', target2, React.createElement('span', null, 'Alive'));
      await flushMicrotasks();
      // Now wait for rAF to fire the prune
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await flushMicrotasks();
    });

    // The disconnected portal should have been pruned
    // Verify by trying to re-render into a new container with the same key
    // (if the key was pruned, the portal map no longer holds it)
    const replacement = document.createElement('div');
    document.body.appendChild(replacement);
    await act(async () => {
      handle.renderPortal('prune-key', replacement, React.createElement('span', null, 'New'));
      await flushMicrotasks();
    });
    expect(replacement.textContent).toBe('New');

    unmount();
  });

  it('should isolate a crashing portal so other portals keep working (#250)', async () => {
    // A custom editor / renderer can throw during render or during a
    // commit-phase effect (e.g., a useEffect cleanup that walks DOM the
    // browser already mutated). Without per-portal isolation, that throw
    // bubbles to the host app's error boundary and shows the
    // "Unexpected Application Error" page. The PortalBoundary inside
    // each portal subtree must absorb the throw so the rest of the grid
    // — and the host app — keep working.
    const { handle, unmount } = mountPortalManager();

    const okTarget = document.createElement('div');
    const badTarget = document.createElement('div');
    document.body.appendChild(okTarget);
    document.body.appendChild(badTarget);

    function Boom(): React.ReactElement {
      throw new Error('boom');
    }

    // Silence the expected error log from React + our own console.error
    const originalError = console.error;
    console.error = () => {
      // intentionally empty — suppress expected error noise during this test
    };

    try {
      await act(async () => {
        handle.renderPortal('ok', okTarget, React.createElement('span', null, 'OK'));
        handle.renderPortal('bad', badTarget, React.createElement(Boom));
        await flushMicrotasks();
      });

      expect(okTarget.textContent).toBe('OK');
      // The bad portal must not poison the manager — okTarget keeps rendering
      // and a subsequent update still works.
      await act(async () => {
        handle.renderPortal('ok', okTarget, React.createElement('span', null, 'Updated'));
        await flushMicrotasks();
      });
      expect(okTarget.textContent).toBe('Updated');
    } finally {
      console.error = originalError;
    }

    unmount();
  });
});
