# Server-Side Plugin

Lazy loading with block caching for large datasets.

## Installation

```typescript
import { ServerSidePlugin } from '@toolbox-web/grid/plugins/server-side';
```

## Usage

```typescript
import { ServerSidePlugin } from '@toolbox-web/grid/plugins/server-side';

grid.gridConfig = {
  plugins: [
    new ServerSidePlugin({
      dataSource: {
        getRows: async (params) => {
          const response = await fetch(`/api/data?start=${params.startRow}&end=${params.endRow}`);
          const data = await response.json();
          return {
            rows: data.rows,
            totalRows: data.total,
          };
        },
      },
      blockSize: 100,
      cacheBlockCount: 10,
    }),
  ],
};
```

## Configuration

| Option            | Type                   | Default | Description                |
| ----------------- | ---------------------- | ------- | -------------------------- |
| `dataSource`      | `ServerSideDataSource` | -       | Data source implementation |
| `blockSize`       | `number`               | `100`   | Rows per block             |
| `cacheBlockCount` | `number`               | `10`    | Max cached blocks          |

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
  totalRows: number;
}
```

## API Methods

Access via `grid.getPlugin(ServerSidePlugin)`:

```typescript
const serverSide = grid.getPlugin(ServerSidePlugin);

// Refresh data (clears cache)
serverSide.refresh();

// Purge cache
serverSide.purgeCache();

// Set new data source
serverSide.setDataSource(newDataSource);
```

## Events

### `server-side-loading`

Fired when loading state changes.

```typescript
grid.addEventListener('server-side-loading', (e) => {
  console.log('Loading:', e.detail.loading);
});
```
