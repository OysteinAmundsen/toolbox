---
domain: release-versioning
related: [build-and-deploy, docs-agent-endpoints]
---

# Release & Versioning — Mental Model

Config: [release-please-config.json](release-please-config.json) + `.release-please-manifest.json` (per branch). CI: [ci.yml](.github/workflows/ci.yml).

## branch model

- MODEL (maintenance-branch, since Jun 2026): `main` = active development of the NEXT major; `<major>.x` = long-lived GA maintenance branch for the previous major. release-please runs per-branch via `target-branch: ${{ github.ref_name }}`, so each branch keeps its OWN release PR + manifest. Backport with `git cherry-pick -x <sha>`. SUPERSEDES the old `next`-branch flow (which forced constant `main → next` forward-merges).
- The previous major gets its `<major>.x` branch the moment the next major's work starts, kept alive until EOL. Cadence target ~1 major/quarter (v1 → v2 was 22 Jan → 16 Apr 2026).
- One config file serves both branches (the earlier `release-please-config.main.json` split was consolidated back in `f6b95d4c`). CI hardcodes `config-file: release-please-config.json`.
- PATTERN: a single PR for all package bumps; component in the tag (`grid-3.0.0-beta.0`). `separate-pull-requests: false`.
- COMMIT TYPES: `feat`/`fix`/`enhance`/`perf` visible in the changelog; `docs`/`style`/`chore`/`refactor`/`test`/`build`/`ci` hidden.
- INVARIANT: each library is an independent release-please component — `feat(<scope>)!:` or a `BREAKING CHANGE:` footer majors ONLY that scope.

## prerelease identifiers & `Release-As` bootstrap

- DECIDED (Jul 2026): changing `prerelease-type` (e.g. `beta` → `rc`) does NOT relabel an in-progress prerelease line. release-please uses it only when ENTERING prerelease from a STABLE version; while on `3.0.0-beta.N` it just increments (`beta.4` → `beta.5`). PROVEN: after flipping the config to `rc`, it still proposed `3.0.0-beta.5`.
- DECIDED (Jul 2026, one-time `Release-As` bootstrap — CONFIRMED WORKING): to switch identifier (`beta`→`rc`) or seed a fresh major's prerelease, push a **per-package, path-scoped** `Release-As` commit. release-please routes a commit to a package by the FILE PATHS it changes (matched against `packages` keys) — NOT the conventional-commit scope (`chore(grid):` is cosmetic). Each commit MUST touch a file under that package's dir; a trailing newline on that package's `CHANGELOG.md` is a harmless routing anchor.
  - RECIPE: `printf '\n' >> libs/grid/CHANGELOG.md && git add … && git commit -m "chore(grid): bootstrap rc line" -m "Release-As: 3.0.0-rc.0"`; adapters (same version) get ONE commit touching all three `libs/grid-{angular,react,vue}/CHANGELOG.md` with `Release-As: 2.0.0-rc.0`.
  - TRAP: one `Release-As` value is written to EVERY package the commit touches — a path-less/empty commit applies it to ALL 4. Always split grid vs adapters, and VERIFY the regenerated PR bumps only the intended packages.
  - After the bootstrap tag exists, release-please auto-increments the new identifier — no further `Release-As`.
- DECIDED (Jul 2026, GA graduation needs the SAME bootstrap): flipping config alone does not deterministically land the clean GA version. Steps: (1) set the branch `"prerelease": false` (or drop it) AND remove `"versioning": "prerelease"` + `"prerelease": true` + `"prerelease-type"` from each package; (2) push per-package, path-scoped `Release-As` commits (grid `3.0.0`, adapters `2.0.0`). WHY explicit: the last tag is a prerelease, and a pending `feat`/breaking commit can push the auto-computed number PAST the clean target. After the GA tags exist, normal semver resumes. AT THE SAME WINDOW flip the `ci.yml` docs-deploy gate + `github-pages` env branch policy. EXECUTED Jul 14 2026: grid `23cb3a70`, adapters `6ca887cd` → release PR #428.
- INVARIANT (stale PR replacement): if a stable release PR was already opened from the wrong config, close it and rerun release-please — adding config alone is not enough (PR #407 kept proposing stable `3.0.0`).
- DECIDED (recovery): when release-please merges a BAD release PR, anchor the config with `last-release-sha` at that PR's merge commit so future runs skip the broken history (`c74b2c8a04f46d675f44ebda1becca7631cfaa4d` = the PR #405 recovery boundary).

## peer-dependency cascade

- INVARIANT: release-please does NOT bump `peerDependencies`. When `grid` jumps a major, every adapter's `peerDependencies."@toolbox-web/grid"` must be widened MANUALLY in the same PR. That peer change is itself breaking, so adapters get a major even with no own deprecation removals.
- DECIDED (#411, prerelease-inclusive peer): while `main` ships `3.0.0-beta.N`, all three adapters ship `^3.0.0-beta` (= `>=3.0.0-beta <4.0.0`), NOT `^3.0.0`. WHY: node-semver excludes prereleases from a range unless a comparator with the same `major.minor.patch` carries a prerelease, so `^3.0.0` does NOT satisfy `3.0.0-beta.N` → unmet-peer / ERESOLVE. `^3.0.0-beta` accepts `3.0.0-beta.N`, `3.0.0` and all `3.x`, and needs NO change at GA. CANONICAL form is `^3.0.0-beta` — do NOT "correct" it to `^3.0.0-beta.0` (functionally identical for every publishable version; would break three-way parity, PR #412 review).
- DECIDED (#411): adapter `devDependencies."@toolbox-web/grid"` stays `>=1.0.0` — adapters compile against workspace SOURCE via tsconfig paths, so the floor only keys the workspace symlink and must match the CURRENT local grid. Any v3 range would break install/linking. The peer/dev "mismatch" is intentional.
- DECIDED (#262, `@nx/dependency-checks` bites grid-vue only): the intentional peer/local mismatch trips the rule for grid-vue because Vite surfaces `@toolbox-web/grid` in the build inputs; ng-packagr does NOT (proven: even `^99.0.0` yields no error) and grid-react has no project-level eslint config enabling the JSON rule. FIX: add `'@toolbox-web/grid'` to `ignoredDependencies` in `libs/grid-vue/eslint.config.mjs`. The `devDependencies` entry does NOT satisfy the rule.
- DECIDED: publish order on a coordinated multi-major is `grid` first, then the three adapters (peer range satisfied at install time). v1.x deprecation commits deliberately do NOT use `!` — that is reserved for the major-bump PR itself.

## publishing & docs deploy

- DECIDED (Jun 2026, npm dist-tag is VERSION-driven not branch-driven): the 4 `publish-*` jobs read `dist/libs/<pkg>/package.json` — version contains `-` → `--tag next`, else `--tag latest`. WHY: under the maintenance-branch model the beta lives on `main`, so the old branch-name rule would have pushed betas to `latest`. The project keeps NO LTS on previous majors, so no manual dist-tag move is ever needed.
- DECIDED (Jun 2026): `build-docs`/`deploy-pages` run only for non-prerelease releases on the CURRENT STABLE branch — the gate is hard-coded to that branch name and must be flipped at each GA.
- INVARIANT (external setting): the GitHub `github-pages` environment's deployment-branch policies MUST include the branch allowed by the docs deploy gate, or `deploy-pages` fails before runner startup with `Branch "…" is not allowed to deploy to github-pages due to environment protection rules.`
- DECIDED (Jul 2026, release-recovery hardening): each `publish-*` job owns post-publish GitHub release reconciliation — after `npm publish` it computes its tag from the dist `package.json` and creates the missing release (`gh release create --verify-tag`, `--prerelease` when the version contains `-`), with notes extracted from that version's `CHANGELOG.md` block into `--notes-file`. A follow-up `reconcile-release-pr` job swaps `autorelease: pending` → `autorelease: tagged` on the merged release PR only after ALL manifest tags have matching releases. WHY: one package's publish failure must not block siblings, and manual reruns must fully clear the release PR.
- DECIDED (Jul 2026, publish-step dedupe): the four jobs keep separate graph nodes / `if:` gates / permissions but delegate their body to the composite action `.github/actions/publish/action.yml` (inputs: package name, dist path, build command, tag/title prefixes, optional post-build command — grid uses `bun run cem`). NOTE: the metadata file MUST stay `action.yml`/`action.yaml`; only the directory name is free.
- DECIDED (Jul 2026, changelog credits): release-please PRs trigger `.github/workflows/release-credits.yml` → `tools/update-release-credits.mjs`, appending `### Community Thanks` to each changed `libs/*/CHANGELOG.md`. Inputs in `.github/credits/{monthly-subscribers,one-time-backers}.json`; state keyed by cycle (release-please head branch) in `.github/credits/issue-submitter-state.json` so reruns are idempotent and one-time credits never repeat.

## `@since` pipeline & version badges

- WHERE: `.github/skills/since-tag/build-since-map.ts` (git-history scan → `since-map.json`), `apply-since-tags.ts` (writes `@since` JSDoc into source), `resolve-since.mjs` (deterministic next-`@since` for one new symbol), [tools/typedoc-mdx-shared.ts](tools/typedoc-mdx-shared.ts) (`sinceBadge`/`sinceBlock`), `libs/grid/scripts/typedoc-to-mdx.ts` (calls them in genClass/genPluginClass/genInterface/genTypeAlias/genFunction/genEnum/genPropertiesTable/genMethod/genAccessor + `genDataGridSplit` Public API), each lib's `typedoc.json` (`blockTags` allowlist includes `@since`). Nothing automated calls these scripts.
- FOOTER: `apps/docs/src/components/VersionBadges.astro` reads `package.json` via static `import` (NOT `readFileSync` — fails in `astro build`); slotted after `<Default />` in `Footer.astro`. CSS in `apps/docs/src/styles/custom.css` (`.since-badge`, `.tbw-versions`).
- INVARIANT: `build-since-map.ts` MUST enumerate EVERY TypeDoc entry point — grid has 1 + 26 plugin entries (`libs/grid/src/lib/plugins/*/index.ts`); missing them silently drops plugin classes from the map and the MDX renders no Since pill.
- INVARIANT: tag-prefix scoping is required — grid uses `grid-` (and legacy `v`), each adapter `grid-<framework>-`. Mixing misattributes versions.
- INVARIANT: `apply-since-tags.ts` is idempotent.
- FLOW (back-fill, once per cycle): `bun .github/skills/since-tag/build-since-map.ts` → `bun .github/skills/since-tag/apply-since-tags.ts` → `bun nx typedoc grid && … grid-angular && … grid-react && … grid-vue`.
- DECIDED: `@since` lives in source JSDoc (survives refactors, visible in IDE hovers); the generator no-ops when absent. Plugin/Adapter splits of `DataGridElement` deliberately do NOT show the pill — only the Public API split. Version badges link to `/grid/<framework>/changelog/`.

## v3.0.0 cleanup (COMPLETED — epic #263)

Shipped: grid **3.x**, adapters **2.x** (peer `^3.0.0`). Every item in #259/#260/#261/#262/#228 landed.

- INVARIANT (Jun 2026 audit): `grep -rn '@deprecated' libs/grid/src libs/grid-{angular,react,vue}/src libs/grid-angular/features --include=*.ts --include=*.tsx --include=*.vue | grep -v '\.spec\.'` returns **ZERO**. Keep it that way — anything newly marked `@deprecated` must carry a removal milestone.
- Removed in v3: `DGEvents`/`DGEventName`/`PluginEvents`/`PluginEventName`; `plugins/reorder-rows/**` + `features/reorder-rows.ts` (and, Jun 2026, the residual `['reorderRows','rowReorder']` aliases on `RowDragDropPlugin`); legacy `PinnedRowsConfig` fields; `RowDragDropConfig.canDragRow`; `ServerSidePlugin.getNodeCount`/`isLoaded`; `activate-cell` event; `SSRProps`/`ssr` prop (React + Vue); `Angular*`/`React*`/`Vue*` config type aliases; per-feature `@deprecated` inputs on `GridDirective`; the 6 shell type re-aliases in `core/types.ts`; the `grid.*` shell delegate methods; TBW076.
- KEPT deliberately (NOT deprecated): `ToolPanelConfig.defaultOpen` (see grid-plugins-shell.md); Vue `TbwGridToolPanel.label` as an alias for the canonical `title` (see adapters-vue.md).
- Angular `MOVE-IN-V2:` markers are resolved — feature code lives in its secondary entry point (ng-packagr forbids primary→secondary imports, so any future move must delete the primary copy in the SAME commit).

**Verification before tagging**

```
bun nx run-many -t build lint test -p grid grid-angular grid-react grid-vue
bun nx build demo-angular && bun nx build demo-react && bun nx build demo-vue   # dangling main-entry imports
bun nx build docs                                                               # stale code blocks
bun nx run grid-angular:typedoc                                                 # regen MDX matches new layout
bun nx run e2e:e2e && bun nx run docs-e2e:e2e
```
