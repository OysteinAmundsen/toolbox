---
name: run-e2e
description: Run the toolbox-web Playwright e2e suites — docs-demo tests, cross-framework parity tests, performance-regression and stability tests. Covers starting demo servers, the various run commands, and updating visual baselines.
---

# Run E2E Suites

Two Playwright e2e suites exist. This skill is the **runbook** — how to execute them and manage servers/baselines. For how to _write_ e2e tests (conventions, utilities, selectors, wait strategies), see the auto-applied `e2e-testing` instruction.

| Suite               | Location         | Purpose                                                            | Server                         |
| ------------------- | ---------------- | ------------------------------------------------------------------ | ------------------------------ |
| **Docs demos**      | `apps/docs-e2e/` | Every Astro demo page renders and works correctly                  | Auto-starts Astro on port 4450 |
| **Cross-framework** | `e2e/`           | Visual/functional parity across Vanilla, React, Angular, Vue demos | Manual server start required   |

## Docs demo tests

Auto-starts the Astro dev server — no manual setup:

```bash
bun nx e2e docs-e2e
```

## Promo recording (`@promo`)

The `@promo` tests in `apps/docs-e2e/tests/promo/` are **normal CI tests** that also double as
the source clips for the promo video. They run as part of `bun nx e2e docs-e2e` at full speed;
the promo config only layers on the visual/pacing extras.

```bash
bun run promo            # → nx run docs-e2e:e2e:promo
PROMO_HEADLESS=1 bun run promo   # no visible window; guarantees an exact 1920×1080 viewport
```

What the promo config changes (`apps/docs-e2e/playwright.promo.config.ts`):

| Setting                              | Why                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `process.env.PW_PROMO_OVERLAY = '1'` | Set in the config, not a shell prefix, so Git Bash / cmd.exe / Nx all behave       |
| `grep: /@promo/`, `workers: 1`       | Scenes record in declaration order so clips can be stitched                        |
| viewport + video `1920×1080`         | Default video size downscales to an 800px box — unusable for a promo               |
| headed by default                    | The run is meant to be watched; `PROMO_HEADLESS=1` forces headless                 |
| `slowMo: 70`                         | Also the frame time for `glidePointer()`; scene pacing lives in `beat()` / `say()` |
| `astro build && astro preview`       | Records the built site — no HMR client, no dev overlay, minified assets            |

Clips land in `apps/docs-e2e/promo-output/<test>/video.webm` — one per test.

> Video clips are large. Do not commit `promo-output/`.

### Stitching the clips into one video

```bash
bun run promo:stitch     # → promo-output/promo.webm
```

Clip order comes from `promo-output/report.json` (the JSON reporter in the promo config), not from
globbing — the output directory names are hashed and unordered. The result is hero first, then the
capability reel in declaration order.

Requires ffmpeg, which is **not** a project dependency. The script looks at `$FFMPEG`, then `PATH`,
then the winget install location (`%LOCALAPPDATA%/Microsoft/WinGet/Packages/Gyan.FFmpeg*/*/bin`
— winget does not put it on the PATH of already-open shells), then `node_modules/ffmpeg-static`.
Install with `winget install Gyan.FFmpeg` or `bun add -d ffmpeg-static`. Without it the script still
prints the ordered clip list and exits 1.

**"http://localhost:4450 is already used"** — Astro 7's `astro dev` backgrounds itself when it
has no TTY (as when Playwright spawns it), so a previous `bun nx e2e docs-e2e` can leave a daemon
holding the port. The promo config deliberately refuses to reuse it, because recording against a
dev server would capture the HMR client. Stop the daemon and re-run:

```bash
cd apps/docs-e2e && bunx astro dev stop
```

## Cross-framework tests

Demo servers must be running first (these tests do **not** auto-start servers).

```bash
# Option 1: start the 4 demo servers in a separate terminal, then run tests
bun run demo              # vanilla=4000, react=4300, angular=4200, vue=4100
bun nx e2e e2e            # run tests against the running servers

# Option 2: build + start dist servers + wait for ports + test (CI-friendly)
bun run e2e:full
```

If a run fails with connection-refused / timeout on ports 4000/4100/4200/4300, the demo servers aren't up — start them (Option 1) or use `e2e:full` (Option 2).

## Update visual baselines

Only after intentionally changing rendered output. Review the regenerated PNGs before committing.

```bash
bun nx e2e:update-snapshots e2e
```

## Performance-regression tests

Part of the regular `e2e` suite. Compares the **current build** against the **latest published release** (loaded from CDN) in the same browser session, so runner variance cancels out. Flags a regression if the current build is **>10% slower**; auto-retries up to 2× to absorb CI noise.

```bash
# Requires a build first (for the local UMD bundle)
bun nx build grid

# Run the self-comparison tests (no demo server needed)
bunx playwright test --config=e2e/playwright.config.ts performance-regression
```

| Env var            | Purpose                                                     |
| ------------------ | ----------------------------------------------------------- |
| `PERF_CDN_VERSION` | Override CDN version to compare against (default: `latest`) |
| `PERF_RUN_ID`      | Unique ID for the output file (`perf-metrics-{runId}.json`) |

## Grid-stability tests

Structural assertions against the vanilla demo (virtualization bounds, zero JS errors, no memory/DOM leaks). Fast, deterministic, part of the regular `e2e` suite — no separate command needed.

| File                                       | Purpose                                     |
| ------------------------------------------ | ------------------------------------------- |
| `e2e/tests/performance-regression.spec.ts` | Self-comparison benchmarks (no demo needed) |
| `e2e/tests/grid-stability.spec.ts`         | Structural stability tests (vanilla demo)   |
| `e2e/tests/perf-metrics-helper.ts`         | Metric accumulator + flush utility          |
