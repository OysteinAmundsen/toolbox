/**
 * Create a requestAnimationFrame-based debounce wrapper. Consecutive calls in the same frame
 * cancel the previous scheduled callback ensuring it runs at most once per frame.
 */
export function rafDebounce<T extends (...args: any[]) => void>(fn: T) {
  let handle: number | null = null;
  const wrapped = (...args: Parameters<T>) => {
    if (handle != null) cancelAnimationFrame(handle);
    handle = requestAnimationFrame(() => {
      handle = null;
      fn(...args);
    });
  };
  (wrapped as any).cancel = () => {
    if (handle != null) cancelAnimationFrame(handle);
    handle = null;
  };
  return wrapped as T & { cancel: () => void };
}
