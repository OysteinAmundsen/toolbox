import { createApp, type App, type Component } from 'vue';

export interface GridCallbackRoot {
  mount: (container: HTMLElement) => () => void;
  mountElement: (className?: string) => HTMLElement;
  cleanupAll: () => void;
}

export function useGridCallbackRoot<TProps extends Record<string, unknown>>(
  component: Component,
  getProps: () => TProps,
): GridCallbackRoot {
  const cleanups = new Set<() => void>();

  const mount = (container: HTMLElement): (() => void) => {
    container.textContent = '';
    const app: App = createApp(component, getProps());
    app.mount(container);

    const cleanup = () => {
      app.unmount();
      container.textContent = '';
      cleanups.delete(cleanup);
    };
    cleanups.add(cleanup);
    return cleanup;
  };

  return {
    mount,
    mountElement: (className?: string) => {
      const host = document.createElement('div');
      if (className) host.className = className;
      mount(host);
      return host;
    },
    cleanupAll: () => {
      for (const cleanup of Array.from(cleanups)) cleanup();
    },
  };
}
