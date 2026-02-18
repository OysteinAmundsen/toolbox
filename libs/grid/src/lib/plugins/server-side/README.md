# Server-Side Plugin

Lazy loading with block caching for large datasets.

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
    const response = await fetch(`/api/data?start=${params.startRow}&end=${params.endRow}`);
    const data = await response.json();
    return {
      rows: data.rows,
      totalRowCount: data.total,
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
interface ServerSideDataSource {
  getRows(params: GetRowsParams): Promise<GetRowsResult>;
}

interface GetRowsParams {
  startRow: number;
  endRow: number;
  sortModel?: SortModel[];
  filterModel?: FilterModel;
}

interface GetRowsResult {
  rows: any[];
  totalRowCount: number;
  lastRow?: number; // If known, for infinite scroll
}
```

## API Methods

Access via `grid.getPlugin(ServerSidePlugin)`:

```typescript
const serverSide = grid.getPlugin(ServerSidePlugin);

// Refresh data (clears cache and reloads)
serverSide.refresh();

// Purge cache only
serverSide.purgeCache();

// Set new data source
serverSide.setDataSource(newDataSource);

// Get total row count
const total = serverSide.getTotalRowCount();

// Check if row is loaded
const loaded = serverSide.isRowLoaded(rowIndex);

// Get loaded block count
const blockCount = serverSide.getLoadedBlockCount();
```
