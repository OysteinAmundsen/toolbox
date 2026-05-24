import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPostMountRefreshHooks, notifyPostMount, registerPostMountRefresh } from './post-mount-refresh-hooks';

describe('post-mount-refresh-hooks (react)', () => {
  afterEach(() => {
    clearPostMountRefreshHooks();
  });

  it('invokes every registered hook with the grid element', () => {
    const gridEl = document.createElement('div');
    const a = vi.fn();
    const b = vi.fn();
    registerPostMountRefresh('a', a);
    registerPostMountRefresh('b', b);

    notifyPostMount(gridEl);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith({ gridEl });
    expect(b).toHaveBeenCalledWith({ gridEl });
  });

  it('replaces an existing hook when re-registering the same name (HMR)', () => {
    const gridEl = document.createElement('div');
    const first = vi.fn();
    const second = vi.fn();
    registerPostMountRefresh('feature', first);
    registerPostMountRefresh('feature', second);

    notifyPostMount(gridEl);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('clearPostMountRefreshHooks removes all hooks', () => {
    const hook = vi.fn();
    registerPostMountRefresh('x', hook);

    clearPostMountRefreshHooks();
    notifyPostMount(document.createElement('div'));

    expect(hook).not.toHaveBeenCalled();
  });

  it('notifyPostMount on an empty registry is a no-op', () => {
    expect(() => notifyPostMount(document.createElement('div'))).not.toThrow();
  });
});
