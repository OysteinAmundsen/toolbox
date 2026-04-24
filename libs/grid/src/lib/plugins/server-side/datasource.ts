import type { GetRowsParams, GetRowsResult, ServerSideDataSource, Subscribable } from './datasource-types';

export function getBlockNumber(nodeIndex: number, blockSize: number): number {
  return Math.floor(nodeIndex / blockSize);
}

export function getBlockRange(blockNumber: number, blockSize: number): { start: number; end: number } {
  return {
    start: blockNumber * blockSize,
    end: (blockNumber + 1) * blockSize,
  };
}

export function getRequiredBlocks(startNode: number, endNode: number, blockSize: number): number[] {
  const startBlock = getBlockNumber(startNode, blockSize);
  const endBlock = getBlockNumber(endNode - 1, blockSize);

  const blocks: number[] = [];
  for (let i = startBlock; i <= endBlock; i++) {
    blocks.push(i);
  }
  return blocks;
}

function isSubscribable<T>(value: unknown): value is Subscribable<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { subscribe?: unknown }).subscribe === 'function' &&
    // Promises don't have `.subscribe`, but defensively rule them out.
    typeof (value as { then?: unknown }).then !== 'function'
  );
}

function makeAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

/**
 * Bridge a `Promise | Subscribable` getRows return value into a single
 * `Promise<GetRowsResult>`. For Subscribables, abort triggers `unsubscribe()`
 * so the underlying request (e.g. Angular `HttpClient` XHR) is cancelled.
 * Promise sources should pass `signal` to `fetch` themselves — we still reject
 * on abort either way so the plugin's abort path is consistent.
 */
export function toResultPromise<T>(
  source: Promise<T> | Subscribable<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(makeAbortError());
  }
  if (!isSubscribable<T>(source)) {
    // Promise path: reject on abort so the plugin's catch sees a consistent
    // signal even if the underlying fetch ignored params.signal.
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(makeAbortError());
      signal.addEventListener('abort', onAbort, { once: true });
      Promise.resolve(source).then(
        (v) => {
          signal.removeEventListener('abort', onAbort);
          resolve(v);
        },
        (e) => {
          signal.removeEventListener('abort', onAbort);
          reject(e);
        },
      );
    });
  }
  // Subscribable path: subscribe once, settle on next/error/complete, and
  // unsubscribe on abort — that's what cancels HttpClient's XHR.
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const subscription = source.subscribe({
      next: (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
        subscription.unsubscribe();
      },
      error: (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      },
      complete: () => {
        if (settled) return;
        settled = true;
        reject(new Error('getRows observable completed without emitting a value'));
      },
    });
    if (settled) return; // synchronous emit
    const onAbort = () => {
      if (settled) return;
      settled = true;
      subscription.unsubscribe();
      reject(makeAbortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function loadBlock(
  dataSource: ServerSideDataSource,
  blockNumber: number,
  blockSize: number,
  params: Partial<GetRowsParams>,
  signal: AbortSignal,
): Promise<GetRowsResult> {
  const range = getBlockRange(blockNumber, blockSize);

  const result = dataSource.getRows({
    startNode: range.start,
    endNode: range.end,
    sortModel: params.sortModel,
    filterModel: params.filterModel,
    signal,
  });
  return toResultPromise(result, signal);
}

export function getRowFromCache(
  nodeIndex: number,
  blockSize: number,
  loadedBlocks: Map<number, unknown[]>,
): unknown | undefined {
  const blockNumber = getBlockNumber(nodeIndex, blockSize);
  const block = loadedBlocks.get(blockNumber);
  if (!block) return undefined;

  const indexInBlock = nodeIndex % blockSize;
  return block[indexInBlock];
}

export function isBlockLoaded(blockNumber: number, loadedBlocks: Map<number, unknown[]>): boolean {
  return loadedBlocks.has(blockNumber);
}

export function isBlockLoading(blockNumber: number, loadingBlocks: Set<number>): boolean {
  return loadingBlocks.has(blockNumber);
}
