import { createGrid, queryGrid, DataGridElement, type ColumnConfig, type GridConfig } from '@toolbox-web/grid';
import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';
import { SelectionPlugin } from '@toolbox-web/grid/all';
import '@toolbox-web/grid/features/filtering';
import { DataGrid } from '@toolbox-web/grid-react';
import { TbwGrid } from '@toolbox-web/grid-vue';

const config: GridConfig = { features: { filtering: true } };
const column: ColumnConfig = { field: 'name', filterable: true };

// These should be rejected if a declaration silently widens an export to `any`.
// @ts-expect-error exported class type must be preserved
const dataGridElementSymbol: symbol = DataGridElement;
// @ts-expect-error plugin class type must be preserved
const filteringPluginSymbol: symbol = FilteringPlugin;
// @ts-expect-error all-in-one entry must preserve exports
const selectionPluginSymbol: symbol = SelectionPlugin;
// @ts-expect-error React component type must be preserved
const reactGridSymbol: symbol = DataGrid;
// @ts-expect-error Vue component type must be preserved
const vueGridSymbol: symbol = TbwGrid;
// @ts-expect-error function types must be preserved
const createGridSymbol: symbol = createGrid;
// @ts-expect-error overloads must be preserved
const queryGridSymbol: symbol = queryGrid;

export {
  config,
  column,
  dataGridElementSymbol,
  filteringPluginSymbol,
  selectionPluginSymbol,
  reactGridSymbol,
  vueGridSymbol,
  createGridSymbol,
  queryGridSymbol,
};
