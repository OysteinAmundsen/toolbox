# Vue Demo Shell

Single Vue 3 + Vite app that hosts every Vue demo grid as a route. Each demo lives
under `src/demos/<demo-name>/` and is registered as a lazy route in
[`src/shell/router.ts`](./src/shell/router.ts).

## Demos

| Route                  | Source                                                                        |
| ---------------------- | ----------------------------------------------------------------------------- |
| `/employee-management` | [`src/demos/employee-management/`](./src/demos/employee-management/README.md) |

## Running

```bash
bun nx serve demo-vue        # http://localhost:4100/<demo-route>
bun nx build demo-vue
```

`/` renders the demo index page (listing every registered route), so existing
health checks (`wait-on http://localhost:4100`) keep working — the index
returns 200.

## Adding a new demo

1. Create `src/demos/<demo-name>/<DemoName>.vue` (single-file component).
2. Register it in [`src/shell/router.ts`](./src/shell/router.ts) with
   `() => import('../demos/<demo-name>/<DemoName>.vue')`.
3. Add a short README under `src/demos/<demo-name>/` describing the demo, then link it from
   the table above.

See [`demos/README.md`](../README.md) for the cross-framework conventions and
[`demos/shared/`](../shared/) for the data/types/styles shared with the other
framework shells.
