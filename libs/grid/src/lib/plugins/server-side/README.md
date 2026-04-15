# Server-Side Plugin

Central data orchestrator for lazy loading with block caching. Provides a **unified DataSource architecture** that other plugins (Tree, GroupingRows, MasterDetail) can consume via events and queries.

## Installation

```typescript
import { ServerSidePlugin } from '@toolbox-web/grid/plugins/server-side';
```

## Usage

```typescript
import { ServerSidePlugin } from '@toolbox-web/grid/plugins/server-side';

const serverSide = new ServerSidePlugin({
  pageSize: 100,
  cacheBlockSize: 100,
});

grid.gridConfig = {
  plugins: [serverSide],
};

// Set data source via method (not config)
serverSide.setDataSource({
  getRows: async (params) => {
    const response = await fetch(`/api/data?start=${params.startNode}&end=${params.endNode}`);
    const data = await response.json();
    return {
      rows: data.rows,
      totalNodeCount: data.total,
    };
  },
});
```

## Configuration

| Option                  | Type     | Default | Description                |
| ----------------------- | -------- | ------- | -------------------------- |
| `pageSize`              | `number` | `100`   | Rows per page/block        |
| `cacheBlockSize`        | `number` | `100`   | Rows per cache block       |
| `maxConcurrentRequests` | `number` | `2`     | Max concurrent block loads |

> **Note:** `dataSource` is set via the `setDataSource()` method, not as a config option.

## Data Source Interface

```typescript
interface ServerSideDataSource<TRow = any> {
  getRows(params: GetRowsParams): Promise<GetRowsResult<TRow>>;
  getChildRows?(params: GetChildRowsParams): Promise<GetChildRowsResult<TRow>>;
}

interface GetRowsParams {
  startNode: number;
  endNode: number;
  sortModel?: unknown[];
  filterModel?: Record<string, unknown>;
}

interface GetRowsResult<TRow = any> {
  rows: TRow[];
  totalNodeCount: number;
  lastNode?: number;
}
```

### Child Rows (Optional)

For hierarchical data (tree nodes, grouped rows, master-detail), implement `getChildRows`:

```typescript
interface GetChildRowsParams {
  parentRow: unknown;
  context: { source: string }; // e.g. 'tree', 'groupingRows', 'masterDetail'
}

interface GetChildRowsResult<TRow = any> {
  rows: TRow[];
}
```

## Events

The plugin broadcasts lifecycle events that other plugins can subscribe to:

| Event                 | Detail Type                | When                               |
| --------------------- | -------------------------- | ---------------------------------- |
| `datasource:data`     | `DataSourceDataDetail`     | Block fetched (includes `claimed`) |
| `datasource:children` | `DataSourceChildrenDetail` | Child rows fetched                 |
| `datasource:loading`  | `DataSourceLoadingDetail`  | Loading state changes              |
| `datasource:error`    | `DataSourceErrorDetail`    | Fetch error occurred               |

## Queries

| Query Type                  | Response             | Purpose                          |
| --------------------------- | -------------------- | -------------------------------- |
| `datasource:is-active`      | `boolean`            | Check if a data source is active |
| `datasource:fetch-children` | `GetChildRowsResult` | Request child rows for a parent  |

## API Methods

Access via `grid.getPluginByName('serverSide')`:

```typescript
const serverSide = grid.getPluginByName('serverSide');

// Refresh data (clears cache and reloads)
serverSide.refresh();

// Purge cache only
serverSide.purgeCache();

// Set new data source
serverSide.setDataSource(newDataSource);

// Get total node count
const total = serverSide.getTotalNodeCount();

// Check if node is loaded
const loaded = serverSide.isNodeLoaded(nodeIndex);

// Get loaded block count
const blockCount = serverSide.getLoadedBlockCount();
```

### Deprecated Methods

| Deprecated           | Replacement           |
| -------------------- | --------------------- |
| `getTotalRowCount()` | `getTotalNodeCount()` |
| `isRowLoaded(index)` | `isNodeLoaded(index)` |

## Migration from v1

| v1 Parameter    | v2 Parameter     |
| --------------- | ---------------- |
| `startRow`      | `startNode`      |
| `endRow`        | `endNode`        |
| `totalRowCount` | `totalNodeCount` |
| `lastRow`       | `lastNode`       |

## Diagnostic Codes

| Code   | Severity | Description                          |
| ------ | -------- | ------------------------------------ |
| TBW140 | error    | `getRows()` fetch failed             |
| TBW141 | error    | `getChildRows()` fetch failed        |
| TBW142 | warn     | Child fetch requested but no handler |
| TBW143 | debug    | Request throttled (concurrent limit) |
