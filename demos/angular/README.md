# Angular Demo Shell

Single Angular 21 app that hosts every Angular demo grid as a route. Each demo lives
under `src/demos/<demo-name>/` and is registered as a lazy `loadComponent` route in
[`src/app.routes.ts`](./src/app.routes.ts).

## Demos

| Route                  | Source                                                                        |
| ---------------------- | ----------------------------------------------------------------------------- |
| `/employee-management` | [`src/demos/employee-management/`](./src/demos/employee-management/README.md) |

## Running

```bash
bun nx serve demo-angular    # http://localhost:4200/<demo-route>
bun nx build demo-angular
```

`/` falls back to the first registered route, so existing health checks
(`wait-on http://localhost:4200`) keep working.

## Adding a new demo

1. Create `src/demos/<demo-name>/<demo-name>.component.ts` as a standalone component.
2. Register it in [`src/app.routes.ts`](./src/app.routes.ts) with
   `loadComponent: () => import('./demos/<demo-name>/<demo-name>.component').then((m) => m.DemoNameComponent)`.
3. Add a short README under `src/demos/<demo-name>/` describing the demo, then link it from
   the table above.

See [`demos/README.md`](../README.md) for the cross-framework conventions and
[`demos/shared/`](../shared/) for the data/types/styles shared with the other
framework shells.
