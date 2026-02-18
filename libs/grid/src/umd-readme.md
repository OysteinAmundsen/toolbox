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
