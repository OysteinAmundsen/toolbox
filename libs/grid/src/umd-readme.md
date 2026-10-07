# CDN Usage

## Core Only

```html
<script src="https://cdn.example.com/@toolbox-web/grid/umd/grid.umd.js"></script>
<script>
  const { createGrid } = TbwGrid;
  const grid = createGrid();
  grid.rows = myData;
  document.body.appendChild(grid);
</script>
```

## All-in-One (core + all plugins)

```html
<script src="https://cdn.example.com/@toolbox-web/grid/umd/grid.all.umd.js"></script>
<script>
  const { createGrid, SelectionPlugin, FilteringPlugin } = TbwGrid;
  const grid = createGrid({
    plugins: [new SelectionPlugin(), new FilteringPlugin()],
  });
  grid.rows = myData;
  document.body.appendChild(grid);
</script>
```

## Core + Individual Plugins

```html
<script src="https://cdn.example.com/@toolbox-web/grid/umd/grid.umd.js"></script>
<script src="https://cdn.example.com/@toolbox-web/grid/umd/plugins/selection.umd.js"></script>
<script>
  const { createGrid } = TbwGrid;
  const { SelectionPlugin } = TbwGridPlugin_selection;
  const grid = createGrid({
    plugins: [new SelectionPlugin({ mode: 'row' })],
  });
  grid.rows = myData;
  document.body.appendChild(grid);
</script>
```

### Plugins with dependencies

`tree.umd.js` and `grouping-rows.umd.js` depend on the hierarchy plugin
(`hierarchy.umd.js`, global `TbwGridPlugin_hierarchy`). Until the next major
release each of them **bundles its own copy** of it, so no extra script is
needed. The grid attaches the hierarchy plugin for you either way.

> **Deprecated:** the next major release stops bundling dependencies into
> individual plugin UMD files. From then on, load `hierarchy.umd.js` before
> `tree.umd.js` / `grouping-rows.umd.js` (or use `grid.all.umd.js`).
