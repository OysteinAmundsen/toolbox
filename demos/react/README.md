# React Demo Shell

Single React 19 + Vite app that hosts every React demo grid as a route. Each demo lives
under `src/demos/<demo-name>/` and is registered as a lazy route in
[`src/shell/App.tsx`](./src/shell/App.tsx).

## Demos

| Route                  | Source                                                                        |
| ---------------------- | ----------------------------------------------------------------------------- |
| `/employee-management` | [`src/demos/employee-management/`](./src/demos/employee-management/README.md) |

## Running

```bash
bun nx serve demo-react      # http://localhost:4300/<demo-route>
bun nx build demo-react
```

`/` renders the demo index page (listing every registered route), so existing
health checks (`wait-on http://localhost:4300`) keep working — the index
returns 200.

## Adding a new demo

1. Create `src/demos/<demo-name>/<DemoName>.tsx` exporting a default-or-named component.
2. Register it in [`src/shell/App.tsx`](./src/shell/App.tsx) with `lazy(() => import(...))`.
3. Add a short README under `src/demos/<demo-name>/` describing the demo, then link it from
   the table above.

See [`demos/README.md`](../README.md) for the cross-framework conventions and
[`demos/shared/`](../shared/) for the data/types/styles shared with the other
framework shells.
