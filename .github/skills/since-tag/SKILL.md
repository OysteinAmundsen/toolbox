---
name: since-tag
description: Determine the correct `@since` JSDoc version for new public API in @toolbox-web libraries, and bulk-refresh existing tags. Use whenever you add a public type, interface, method, property, exported constant, or event detail and need its `@since` value — instead of guessing.
---

# `@since` Tag Versioning

`@since` tags appear verbatim in the TypeDoc API reference and the docs site, so a wrong value misleads users about which release introduced an API. **Never copy a `@since` from a neighboring symbol and never guess** — resolve it deterministically with the script below.

All scripts for this concern live in this skill folder (nothing else in the repo calls them):

| File                  | Purpose                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `resolve-since.mjs`   | Compute the `@since` version for ONE new symbol you're adding now        |
| `build-since-map.ts`  | Bulk: scan git history → `since-map.json` (first release tag per export) |
| `apply-since-tags.ts` | Bulk: write `@since` tags from `since-map.json` into source              |
| `since-map.json`      | Generated map consumed by `apply-since-tags.ts`                          |

## Single new symbol (the common case)

Run the resolver with the affected library and your change's commit type. It prints the version to stdout and a one-line explanation to stderr.

```bash
bun .github/skills/since-tag/resolve-since.mjs <lib> <bump>
```

- `<lib>`: `grid` | `grid-angular` | `grid-react` | `grid-vue` (default `grid`)
- `<bump>`: `feat` | `fix` | `perf` | `refactor` | `breaking` (or explicit `major`/`minor`/`patch`; default `feat`)
- `--no-fetch`: skip the best-effort fetch of the release-please branch (use offline or to keep it fast when the remote-tracking ref is already local)

```bash
# Adding a new feature to the core grid:
bun .github/skills/since-tag/resolve-since.mjs grid feat        # → 2.16.0

# Capture for scripting:
SINCE=$(bun .github/skills/since-tag/resolve-since.mjs grid-react fix)
```

Then stamp the printed value on the declaration:

```ts
/** @since 2.16.0 */
export interface NewThing { … }
```

### How it resolves (deterministic)

```
lastReleased = .release-please-manifest.json["libs/<lib>"]   (authoritative)
staged       = version in libs/<lib>/package.json on
               origin/release-please--branches--main, else lastReleased
prCandidate  = lastReleased bumped by <bump>'s tier
result       = semver max(staged, prCandidate)
```

A PR can only **raise** release-please's staged tier, never lower it, so the max is always correct:

| Staged (queued)   | Your PR    | Result                              |
| ----------------- | ---------- | ----------------------------------- |
| `2.16.0` (`feat`) | `fix`      | `2.16.0` — staged wins              |
| `2.15.2` (`fix`)  | `feat`     | `2.16.0` — your PR upgrades tier    |
| `2.16.0` (`feat`) | `breaking` | `3.0.0` — your PR upgrades to major |
| none              | `feat`     | `2.16.0` — lastReleased + minor     |

> Tier mapping mirrors `release-please-config.json`: `feat:` → minor; `fix:`/`perf:`/`refactor:` → patch; `feat!:`/`BREAKING CHANGE` → major. When genuinely unsure whether your change is a feat or a fix, ask the user before stamping.

## Bulk refresh from git history

Use after a release cycle to back-fill / correct `@since` across all public exports. `apply-since-tags.ts` is idempotent (skips declarations that already have any `@since`); `--force` rewrites stale tags to match the regenerated map.

```bash
bun .github/skills/since-tag/build-since-map.ts
bun .github/skills/since-tag/apply-since-tags.ts            # or --force
# Regenerate API docs so the Since pills update:
bun nx typedoc grid && bun nx typedoc grid-angular && bun nx typedoc grid-react && bun nx typedoc grid-vue
```

> `build-since-map.ts` MUST enumerate every TypeDoc entry point (grid `src/public.ts` + every `libs/grid/src/lib/plugins/*/index.ts`, plus each adapter's single entry). Missing an entry silently drops those symbols from the map and the docs render no Since pill.
