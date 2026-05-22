import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

export interface GridCallbackRootApi {
  renderInto: (container: HTMLElement, node: ReactNode) => () => void;
  renderElement: (node: ReactNode, className?: string) => HTMLElement;
}

export function useGridCallbackRoot(): GridCallbackRootApi {
  const rootsRef = useRef(new Set<Root>());

  useEffect(() => {
    const roots = rootsRef.current;
    return () => {
      for (const root of roots) root.unmount();
      roots.clear();
    };
  }, []);

  const renderInto = useCallback((container: HTMLElement, node: ReactNode) => {
    const root = createRoot(container);
    rootsRef.current.add(root);
    root.render(node);

    return () => {
      root.unmount();
      rootsRef.current.delete(root);
    };
  }, []);

  const renderElement = useCallback(
    (node: ReactNode, className?: string) => {
      const container = document.createElement('div');
      if (className) container.className = className;
      const cleanup = renderInto(container, node);

      queueMicrotask(() => {
        const parent = container.parentElement;
        if (!parent) {
          if (!container.isConnected) cleanup();
          return;
        }

        const observer = new MutationObserver(() => {
          if (container.isConnected) return;
          observer.disconnect();
          cleanup();
        });
        observer.observe(parent, { childList: true });
      });

      return container;
    },
    [renderInto],
  );

  return useMemo(() => ({ renderInto, renderElement }), [renderInto, renderElement]);
}
