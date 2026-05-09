# Vanilla Demo Shell

Single TypeScript + Vite app that hosts every vanilla demo grid as a route. Each demo
lives under `src/demos/<demo-name>/` and is registered as a lazy route in
[`src/main.ts`](./src/main.ts) via the hand-rolled router at
[`src/shell/router.ts`](./src/shell/router.ts).

## Demos

| Route                  | Source                                                                        |
| ---------------------- | ----------------------------------------------------------------------------- |
| `/employee-management` | [`src/demos/employee-management/`](./src/demos/employee-management/README.md) |

## Running

```bash
bun nx serve demo-vanilla    # http://localhost:4000/<demo-route>
bun nx build demo-vanilla
```

`/` falls back to the first registered route, so existing health checks
(`wait-on http://localhost:4000`) keep working.

## Adding a new demo

1. Create `src/demos/<demo-name>/index.ts` exporting `mount(host: HTMLElement): () => void`
   (mount returns a teardown).
2. (Optional) Add `src/demos/<demo-name>/grid-factory.ts` exporting a pure factory
   function — the docs site can then import it via the `@demo/vanilla/<demo-name>` alias
   (see [`apps/docs/astro.config.mjs`](../../apps/docs/astro.config.mjs)).
3. Register the route in [`src/main.ts`](./src/main.ts) with
   `{ name: '<demo-name>', load: () => import('./demos/<demo-name>') }`.
4. Add a short README under `src/demos/<demo-name>/` describing the demo, then link it from
   the table above.

See [`demos/README.md`](../README.md) for the cross-framework conventions and
[`demos/shared/`](../shared/) for the data/types/styles shared with the other
framework shells.
