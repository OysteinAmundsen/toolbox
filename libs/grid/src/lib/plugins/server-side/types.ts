export interface ServerSideConfig {
  pageSize?: number;
  cacheBlockSize?: number;
  maxConcurrentRequests?: number;
}

export interface ServerSideDataSource {
  getRows(params: GetRowsParams): Promise<GetRowsResult>;
}

export interface GetRowsParams {
  startRow: number;
  endRow: number;
  sortModel?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  filterModel?: Record<string, any>;
}

export interface GetRowsResult {
  rows: any[];
  totalRowCount: number;
  lastRow?: number; // If known, for infinite scroll
}

export interface ServerSideState {
  dataSource: ServerSideDataSource | null;
  totalRowCount: number;
  loadedBlocks: Map<number, any[]>;
  loadingBlocks: Set<number>;
  lastRequestId: number;
  /** Scroll debounce timer for scroll-end detection */
  scrollDebounceTimer?: ReturnType<typeof setTimeout>;
  /** Cached grid reference for getting fresh viewport */
  gridRef?: { virtualization: { start: number; end: number } };
  /** Cached config reference */
  configRef?: ServerSideConfig;
  /** Cached request render function */
  requestRenderRef?: () => void;
}
