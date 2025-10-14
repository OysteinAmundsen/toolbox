# CDN Usage

## Core Only

```html
<script src="https://cdn.example.com/@toolbox-web/grid/umd/grid.umd.js"></script>
<script>
  const { registerPlugin } = TbwGrid;
</script>
```

## All-in-One (core + all plugins)

```html
<script src="https://cdn.example.com/@toolbox-web/grid/umd/grid.all.umd.js"></script>
<script>
  const { registerPlugin, selectionPlugin } = TbwGrid;
  registerPlugin(selectionPlugin);
</script>
```

## Core + Individual Plugins

```html
<script src="https://cdn.example.com/@toolbox-web/grid/umd/grid.umd.js"></script>
<script src="https://cdn.example.com/@toolbox-web/grid/umd/plugins/selection.umd.js"></script>
<script>
  TbwGrid.registerPlugin(TbwGridPlugin_selection.selectionPlugin);
</script>
```
