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
export function toResultPromise<T>(source: Promise<T> | Subscribable<T>, signal: AbortSignal): Promise<T> {
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
    pageSize: range.end - range.start,
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

/**
 * Build a default {@link ServerSideDataSource} that fetches the whole dataset
 * from a URL once and serves it in blocks from memory. Powers the declarative
 * `<tbw-grid data-src="...">` shorthand (issue #273) so a zero-JS HTML page can
 * render server-fetched rows.
 *
 * The endpoint may return either a plain array of rows (`[...]`) or an envelope
 * (`{ rows, totalNodeCount }`). The fetch runs at most once on success — the
 * resolved dataset is cached and sliced per `getRows` block — so a static JSON
 * file works out of the box. A failed (or aborted) fetch is not cached, so a
 * later block request retries instead of leaving the grid permanently empty.
 * For true server-side pagination (per-block fetches, remote sort/filter),
 * provide a `dataSource` in the plugin config instead.
 *
 * @param url Absolute or relative URL fetched with the request's abort signal.
 * @internal
 */
export function createUrlDataSource(url: string): ServerSideDataSource {
  let datasetPromise: Promise<{ rows: unknown[]; total: number }> | null = null;

  const loadDataset = (signal: AbortSignal): Promise<{ rows: unknown[]; total: number }> => {
    if (!datasetPromise) {
      datasetPromise = fetch(url, { signal })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch "${url}": ${response.status} ${response.statusText}`);
          }
          const data: unknown = await response.json();
          if (Array.isArray(data)) {
            return { rows: data, total: data.length };
          }
          const envelope = (data ?? {}) as { rows?: unknown[]; totalNodeCount?: number };
          const rows = Array.isArray(envelope.rows) ? envelope.rows : [];
          const total = typeof envelope.totalNodeCount === 'number' ? envelope.totalNodeCount : rows.length;
          return { rows, total };
        })
        .catch((err) => {
          // Don't cache failures/aborts — the plugin aborts in-flight block
          // requests on sort/filter/refresh, and caching the rejected promise
          // would poison every later block load. Null it so the next request
          // re-fetches.
          datasetPromise = null;
          throw err;
        });
    }
    return datasetPromise;
  };

  return {
    async getRows({ startNode, endNode, signal }: GetRowsParams): Promise<GetRowsResult> {
      const { rows, total } = await loadDataset(signal);
      return { rows: rows.slice(startNode, endNode), totalNodeCount: total };
    },
  };
}
