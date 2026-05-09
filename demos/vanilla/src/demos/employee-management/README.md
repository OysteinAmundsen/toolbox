# Employee Management Demo (Vanilla)

Reference implementation of the employee-management grid using `@toolbox-web/grid`
directly — no framework adapter, just the native `<tbw-grid>` web component.

This vanilla version is the **canonical** demo: its `createEmployeeGrid()` factory is
also imported by the docs site (via the `@demo/vanilla/employee-management` alias) so
that documentation pages render the exact same configuration users see at
`http://localhost:4000/employee-management`.

## Features Demonstrated

- 15+ plugins (selection, filtering, sorting, editing, master-detail, export, …)
- Custom editors (star rating, bonus slider, status select, date picker)
- Custom renderers (status badges, rating colors, top-performer marker)
- Pinned rows + footer aggregation
- Responsive card layout
- Shell tool panels (analytics, quick filters)

## Running

```bash
bun nx serve demo-vanilla
```

Open <http://localhost:4000/employee-management>.

## Project Structure

```
demos/vanilla/src/demos/employee-management/
├── grid-factory.ts   # Pure createEmployeeGrid() — also reused by docs site
├── index.ts          # Route module: control panel + mount/teardown
├── grid-config.ts    # Column / plugin / pinned-row config
├── editors.ts        # Custom cell editors
├── renderers.ts      # Custom cell renderers
├── tool-panels.ts    # Sidebar tool panels
└── README.md         # This file
```

The shell that hosts this demo lives at [`demos/vanilla/`](../../..) — see its README
for the router setup.

## Related

- [React implementation](../../../../react/src/demos/employee-management/README.md)
- [Vue implementation](../../../../vue/src/demos/employee-management/README.md)
- [Angular implementation](../../../../angular/src/demos/employee-management/README.md)
- [`@toolbox-web/grid`](../../../../../libs/grid/README.md)
