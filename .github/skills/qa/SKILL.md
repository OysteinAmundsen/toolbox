---
name: qa
description: Local pre-commit code review **and fix**. Reviews the target scope (file, folder, uncommitted changes, or the whole branch vs its base), produces an actionable findings list, then applies the fixes — same loop as opening a PR, getting Copilot review comments, and having an agent address them, but entirely local. Append `report-only` to skip the fix step.
disable-model-invocation: true
argument-hint: '[optional file/folder path | "branch [base-ref]"] [optional "report-only"]'
---

# QA Review + Fix

End-to-end local quality loop:

1. **Review** the target scope with the same rigor as the GitHub Copilot PR reviewer.
2. **Report** findings in a normalized format that can be executed by the shared `qa-apply-findings` skill.
3. **Fix + validate** by delegating to `qa-apply-findings` (execution core shared with the `qa-pr` triage flow).
4. **Summarize** what was changed, what was left, and why.

The user runs this _before_ committing so problems are caught locally instead of waiting for the PR reviewer.
Once a PR exists and has review comments, use `/qa-pr <PR number>` instead (the remote half of QA).

### Scripts (`.github/skills/qa/scripts/`, Bun, run from repo root)

| Script              | Purpose                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `spec-typecheck.ts` | `tsc` each touched `*.spec.ts`, report only errors on changed lines (`[--base <ref>]` for branch mode).           |
| `probe.ts`          | Run a throwaway integration probe (`--from <spec> --body <file> --name <topic>`), print `PROBE` lines, delete it. |
| `mutation-check.ts` | Prove a test guards a fix: swap one text occurrence back to the broken code, expect red, restore byte-exact.      |

---

## 1. Parse the argument

The text after `/qa` may contain:

- A file path → review that file.
- A folder path → review every source file under it (recursive; exclude `node_modules`, `dist`, `build`, `coverage`, `.nx`, generated code).
- The literal token `report-only` (alone or trailing the path) → run steps 1–4 only; **skip** the fix step (§5). Echo back at the top of the report that fix mode is disabled.
- The literal token `branch` (alone or trailing a base ref, e.g. `branch origin/next`) → review **everything this branch added since it diverged from its base** — the precursor-QA-for-a-PR mode. This is the same diff the eventual PR will show.
  - Resolve the base ref: use the one given after `branch`, else default to `origin/main` (fall back to `main` if there is no remote). Run `git fetch origin <base>` first so the comparison is against the up-to-date base.
  - Find the fork point: `git merge-base HEAD <base>`.
  - List changed files: `git diff --stat <base>...HEAD`. Read hunks with `git diff <base>...HEAD`.
  - **Use three-dot (`<base>...HEAD`), never two-dot.** Three-dot diffs against the merge-base, so it shows only what _this branch_ changed and excludes commits that landed on the base after you forked. Two-dot would fold in unrelated upstream changes you didn't write.
  - Read net-new files in full (a three-dot diff renders them as all-additions; reading the whole file gives surrounding context for correctness judgments).
  - In the fix step (§5), still scope validation to the affected Nx projects (`bun nx affected -t lint,test` works against the same base).
- Empty / not provided → review the uncommitted working tree:
  - `git status --porcelain` for the file list.
  - `git diff --staged` and `git diff` for hunks.
  - For untracked files, read them in full.
  - Focus on **what changed**, but read enough surrounding code to judge correctness.

If the working tree is clean and no path was given, report that and stop. (In `branch` mode, if `<base>...HEAD` is empty — the branch is level with base — report that and stop.)

## 2. Load workspace conventions

Before reviewing, load the convention sources that apply to files in scope:

- `.github/copilot-instructions.md` and/or `AGENTS.md` at each workspace root that owns a file in scope.
- Any `.github/instructions/*.instructions.md` whose `applyTo` glob matches a file in scope.
- Any `.github/knowledge/*.md` files whose domain is touched (read the relevant ones, not all).

These are the contract the code must obey. Cite specific rules by filename when flagging violations.

## 3. Review checklist

For each file (or each hunk, when reviewing a diff), check:

### Correctness & bugs

- Off-by-one, null/undefined access, unhandled promise rejections, missing `await`.
- Incorrect equality (`==` vs `===`), accidental reassignment, shadowed variables.
- Dead code, unreachable branches, contradictory conditions.
- Race conditions, stale closures (especially in React hooks: missing/incorrect `useEffect` deps).
- Type assertions that hide real type errors (`as any`, `as unknown as T`, non-null `!`).
- **Spec type errors** — no gate type-checks `*.spec.ts` (lint/test/build all pass over a hard `TS2322`): see
  `build-and-deploy.md` → `INVARIANT (#470)`. Run `bun .github/skills/qa/scripts/spec-typecheck.ts` (add
  `--base <ref>` in `branch` mode). It runs the one-file `tsc --ignoreConfig` recipe on each touched spec and reports
  only errors on changed lines, since specs on `main` already carry dozens of pre-existing errors. It exits 1 when
  one of those lands on a changed line.

### Security (OWASP-aware)

- Injection (SQL, command, prompt, XSS via `dangerouslySetInnerHTML`, `innerHTML`, `eval`).
- Hard-coded secrets, tokens, credentials, connection strings.
- Unsafe deserialization, path traversal (`../`), SSRF in fetch/HTTP calls.
- Missing authn/authz checks on new endpoints or tool surfaces.
- Logging of sensitive data (PII, tokens).
- Dependency additions: flag any new package and call out if it looks unmaintained / typosquatted.

### Workspace conventions

- File/folder naming, public-API boundaries (no deep imports into `internal/`, `src/lib/...`).
- Forbidden patterns called out in instruction files (e.g. `as unknown as`, `T[]` vs `Array<T>`). Grep the
  added lines instead of eyeballing hunks — reading misses casts in spec fixtures (PR #566 shipped one):
  `git diff <base> -U0 | Select-String '^\+.*as unknown as'` (diff mode: `git diff -U0` + `git diff --staged -U0`).
- Generated/legacy preferences.
- Test conventions (co-located `*.spec.ts`, `waitUpgrade()`, no skipped tests left behind).

### Best practices

- Single-responsibility; functions doing too much.
- Public API additions: stable types, consistent naming, documented.
- Error handling at boundaries only — no defensive try/catch around impossible cases.
- React: stable hook deps, memoization where it matters, keys not array index.
- CSS: tokens over hardcoded values, no `!important` without justification.
- Performance hotspots: synchronous work in render, unbounded loops, N+1 fetches.

### Hygiene

- Leftover `console.log`, `debugger`, `TODO`/`FIXME` without an issue link, commented-out code.
- Stale or contradictory comments.
- Bundle-budget risk for `libs/grid/**` changes — flag if change looks heavy.

### Automated quality scan (fallow)

Run the fallow codebase intelligence tool to get deterministic complexity, dead-code, and duplication findings. Use the `fallow` skill for the full command reference.

**For `branch` or diff mode** (reviewing changed files):

```bash
bunx fallow audit --base <resolved-base-ref> --format json > tmp/fallow-audit.json
```

**For single-file or folder mode**:

```bash
# `health` has no `--file` flag — run it whole-repo, then keep only findings[] whose `path` is in scope.
bunx fallow health --format json > tmp/fallow-audit.json
# or for dead-code:
bunx fallow dead-code --format json > tmp/fallow-audit.json
```

Without coverage input, `crap` assumes 0 % coverage (CRAP = cyclomatic² + cyclomatic), so treat high CRAP on a
well-tested file as complexity debt, not an introduced regression. When `audit` fails on CRAP alone, re-score it
with real coverage before reporting anything, once per affected project that writes lcov — today only `grid`:
`bun nx test grid --coverage`, then
`bun .github/skills/fallow/scripts/crap-from-lcov.ts --lcov coverage/libs/grid/lcov.info --root libs/grid`
(see the `fallow` skill). Only `ok (coverage artifact)` rows are cleared. Report `REAL` rows at their fallow
tier, and `UNVERIFIED (no lcov)` rows (files outside that lcov, e.g. adapter code — the adapters emit no lcov)
at their fallow tier marked "unverified, no coverage" — never drop them.

**For full working-tree scope** (uncommitted changes):

```bash
bunx fallow audit --base HEAD --format json > tmp/fallow-audit.json
```

Use `audit --base HEAD`, not bare `bunx fallow`: bare output (11 MB, `check`/`dupes`/`health` keys) has no
`introduced` flags and no `complexity.findings`, so `crap-from-lcov.ts` silently prints "No complexity findings
to re-score". `audit` exits 1 on any introduced finding — read `verdict` and the findings, not the exit code.

After running, read `tmp/fallow-audit.json` and extract findings. Map to report severity:

| fallow finding                                                          | Report tier                                     |
| ----------------------------------------------------------------------- | ----------------------------------------------- |
| `critical` and `introduced: true` (in audit)                            | **Blocking** if CRAP > 200, else **Should fix** |
| `high` and `introduced: true`                                           | **Should fix**                                  |
| `moderate`                                                              | **Nit**                                         |
| dead-code (`unused-export`, `unused-file`) in `libs/grid/src/public.ts` | **Blocking**                                    |
| dead-code elsewhere                                                     | **Should fix**                                  |
| `duplication` clone group overlapping a changed hunk (specs included)   | **Should fix**                                  |
| `circular-dependencies`                                                 | **Blocking**                                    |

Filter out findings in `libs/grid/scripts/`, `tools/`, `demos/`, and `apps/docs/` with CRAP < 900 (these have relaxed thresholds per `.fallowrc.json`). Include all others.

**Duplication is scoped by hunk, not by file.** `audit` marks every clone group in a touched file `introduced`, so a
spec with long-standing repeated setup floods the list. Keep only groups where some instance's
`[start_line, end_line]` overlaps a `git diff -U0 <base>` hunk range of the same file — those are clones the change
added. No duplication is allowed, tests included: extract a local helper in the enclosing `describe`.

If `duplication_introduced` suddenly jumps to ~the whole repo's group count (#547: 1 → 109) after a file was
rewritten by a script, check line endings first. On this Windows (`core.autocrlf=true`) tree, a file saved with LF
while the base worktree is CRLF makes fallow's baseline comparison miss every group. Restore CRLF and re-run.
`git diff` hides this because it normalizes line endings.

Hunk overlap is only a proxy: a uniform rename across a file (e.g. `foo()` → `bar()` at every call site) overlaps
pre-existing clones without creating any. Before reporting an overlap from such an edit, confirm per file that the
clone-group count actually grew. Run `bunx fallow dupes --format json` on the current tree, then on a **separate
checkout of the comparison revision** — the merge-base from §1 in `branch` mode, `HEAD` otherwise — so the user's
working tree and stash are never touched (`git stash` would leave committed branch changes in place, and on a clean
tree `git stash pop` would pop an unrelated stash):

```powershell
$wt = "$env:TEMP\qa-dupes-base"; git worktree add --detach $wt <rev>
New-Item -ItemType Junction -Path "$wt\node_modules" -Target "$PWD\node_modules" | Out-Null
try { Push-Location $wt; bunx fallow dupes --format json --quiet > "$env:TEMP\dupes-base.json" }
finally { Pop-Location; (Get-Item "$wt\node_modules").Delete(); git worktree remove --force $wt }
```

The `node_modules` junction is required: without it fallow's test plugins never activate, specs and e2e drop out of the
scan, and the baseline is silently partial (640 vs 951 files, ≈200 vs ≈1400 groups). That is also why fallow's own
`%TEMP%\fallow-audit-base-cache-*` worktrees are not a usable baseline. Delete the junction with `.Delete()` **before**
`git worktree remove`, so the removal cannot recurse into the real `node_modules`. In PowerShell, never dedupe
clone-group objects with `Select-Object -Unique` — it compares `ToString()` and collapses every group into one; dedupe
on a `"path:start-end"` string instead.

Each fallow finding becomes one report item with the fallow `path:line` as the location. Quote the fallow `description` as the Problem and use the `actions[0].description` as the Fix suggestion.

### Documentation accuracy (treat prose as untrusted)

Any prose added or modified by the diff — code comments, JSDoc, README, knowledge `DECIDED` entries, `@deprecated`/`@since` notes — is **not** authoritative narration of the code. Verify each prose claim against the actual implementation. This is the defect class the GitHub Copilot reviewer catches most consistently.

For every modified or new prose block:

1. **Within the same file:** read the body of the function/class/field the prose describes and confirm it matches. Watch negations ("does NOT track"), enumerations ("excludes a, b, and c"), and version claims.
2. **Cross-file:** if prose claims behavior elsewhere ("plugin X no longer needs Y"), `grep` for the symbol and verify.
3. **Against package state:** version strings in `@deprecated`/`@since` must match `package.json`.
4. **Knowledge files:** `DECIDED` entries are contracts. If a `DECIDED` claim contradicts code in scope, flag it explicitly and say which side you believe is correct (the entry usually wins; the diff under review may be the legitimate update).

When prose disagrees with code, treat it as **Should fix** at minimum (**Blocking** if on a public API surface).

### Interaction & adversarial review (beyond the hunk)

Hunk-local checks miss the defect class the Copilot reviewer finds most on this repo: how the change behaves
**combined with code the diff does not touch**. On PR #604 it found three such bugs in a row, and a hunk-scoped `/qa` missed all three. Two were plugin-order bugs (Pivot/GroupingColumns/PinnedColumns registered after
ColumnVirtualization). The third was a shrunken pivot misread as scroll feedback. Run this for every changed
function, class, or field that takes part in a shared mechanism: plugin hooks, queries, events, shared helpers,
or cached state.

1. **Map the blast radius.** Grep every other implementer and consumer of each touched mechanism, and read their
   bodies, not just their signatures. Example: `override <hook>\(|hookPriority|query\.type === '<q>'|'<q>'`. Include
   the core side that feeds it. For plugins that means `grid.ts#processColumns`, `config-manager.ts#merge` and
   `plugin-manager.ts` dispatch. The knowledge `FLOW:` entries and `data-flow-traces.md` name the path.
2. **Combination matrix, both registration orders.** For each interacting plugin, ask what the change does when
   the plugin runs before it and when it runs after. Plugin array order decides hook order unless `hookPriority`
   overrides it. Check these hazards:
   - replacement (Pivot swaps the whole column list);
   - cloning (`{ ...col }` breaks identity);
   - reordering (pinning), including hidden columns;
   - utility columns rebuilt on every pass;
   - feedback loops (core re-seeds `#baseColumns` from processed `_columns`);
   - `hookPriority` changes: ties run in array order, so a new priority moves the plugin past EVERY
     equal-priority plugin registered on the other side, not just the one targeted. Probe `[X, changed]` with a
     utility-column plugin as X (#613 QA: Pivot `processColumns: -15` added empty expander/drag columns, #616).
3. **Falsify every classifier.** Every condition the diff adds that sorts inputs into kinds is a hypothesis. Typical
   forms are "fewer columns ⇒ scroll pass", "same fields ⇒ feedback", or a cache keyed on length or identity.
   Construct a concrete input that satisfies the condition but means the other thing, and the reverse. Read the
   defaults that shape that input (e.g. `showTotals`, `overscan`, `threshold`).
4. **Staleness of stored state.** For each new or changed field that caches derived state, list every event that
   must refresh it and confirm each path does. Events to check: config replaced (larger _and_ smaller), runtime
   setters, hide/show, row data change, plugin detach, and a re-run in each render phase.
   - **Flag flips.** When the diff makes a mode flag recompute more often (e.g. `isVirtualized` recounted every
     pass), anything written under the ON branch (inline styles, cached offsets, skipped input like `scrollLeft`)
     must be torn down or kept current on the OFF branch. Probe ON → OFF → ON (#603 QA: stale 1700px header
     padding after hiding columns below the threshold). Value switches count too, not just on/off: a pin moved
     `left → right` replays the cached OLD side until the next recompute (PR #617 round 2, #619). Make test helpers
     report every state class, not the first match, or a cell in both states passes as one. When a fix has a
     cache layer AND a self-correcting layer (e.g. a later re-measure), the end state hides the cache layer: assert
     the intermediate state in the grid's public `render` event, which fires after `afterRender` hooks but before
     their queued microtasks (PR #617 round 4).
   - **Index spaces.** When a list's meaning widens (window → full list), grep every consumer that writes an
     index into another list's space (`_focusCol = <order index>`, `data-col`, selection ranges). Follow aliases
     to their call sites (#607: Pivot's `get gridColumns() { return this.grid.columns }` fed `renderRow`).
5. **Prove, don't argue.** Any candidate from 2–4 that reading cannot rule out gets a throwaway probe:
   - Write only the probe body: `it(...)` blocks that `console.log('PROBE …')` the measured values.
   - Run `bun .github/skills/qa/scripts/probe.ts --from <existing integration spec> --body <file> --name <topic>`.
     It copies the spec for its helpers, skips its suites, runs yours, prints the `PROBE` lines and deletes the file.
     The body shares the spec's module scope: never re-import a symbol the spec already imports (duplicate
     binding → `Transform failed`, no tests run). happy-dom has no layout (`offsetWidth` = 0), so a probe can
     prove sticky classes/side but not offset arithmetic (every pin reads `0px`); say so in **Evidence**. To
     exercise real offsets, stub `offsetWidth` on the measured element
     (`Object.defineProperty(el, 'offsetWidth', { value: 80, configurable: true })`). happy-dom also rejects `\"` and
     `CSS.escape` output inside a quoted attribute selector; use hex escapes (`\22 `) — `dataFieldSelector`.
   - Only measured defects become findings; put the numbers in **Evidence**.
   - Always measure a **control** too: the same probe without the changed plugin or flag. A defect that reproduces
     anyway is pre-existing: file it as a bug issue (delivery-workflow), unless the diff widens its reach, in which
     case it is a finding. To control against the unchanged source, back up the file, write HEAD with
     `cmd /c "git show HEAD:<path> > <path-with-backslashes>"` (byte-exact; `Set-Content -NoNewline` joins the
     lines and breaks the module), run the probe, and restore the backup in a `finally`.
   - Drive the state through an API that actually carries it before trusting a negative result. `ColumnState` has no
     `pinned`, so `applyColumnState({ pinned })` is a silent no-op; use `PinnedColumnsPlugin.setPinPosition` (#613).
   - When a finding is fixed, prove the new test guards it with
     `bun .github/skills/qa/scripts/mutation-check.ts --file <src> --spec <filter> --find <fixed> --replace <broken>`.
     It must print `KILLED`.
6. **Re-review review-driven code first.** Code written to answer an earlier review comment is where the next
   comment lands. Run step 3 on it before anything else.

### Fresh-context pass (author bias)

When `/qa` runs in the session that wrote the code, the reviewer shares the author's assumptions. A gap the author
knowingly left looks "fine" even though an outside reviewer will probe it. So in `full` AI mode, after your own pass,
launch **one** `code-review` subagent. Give it a fresh context containing:

- the diff range (or file list);
- the interaction points from step 1;
- the classifiers from step 3;
- an instruction to apply steps 2–4 adversarially and return only high-confidence findings with `path:line` and a
  concrete triggering input.

Verify each returned finding yourself (step 5) before it enters the report, and dedupe against your own findings.
In `saving` mode, skip the subagent and list the step-1/step-3 inventory in the report so the user can decide.

## 4. Report format — must be agent-actionable

Normalize findings so they are directly consumable by
`.github/skills/qa-apply-findings/`:

- Use `.github/skills/qa-apply-findings/findings.schema.json` as the contract.
- Start from `.github/skills/qa-apply-findings/findings.template.json`.
- Keep legacy human-readable sections (`Blocking`, `Should fix`, `Nits`) for user readability,
  but ensure each finding can be represented as one normalized item with an ID (`B1`, `S2`, `N3`).

Output **one finding per actionable defect**, in this exact shape:

````
## QA Review — <scope summary>
<If `report-only` mode: prepend a line "_Fix step skipped (report-only)_">

### Blocking (N)

#### B1 · <one-line title> — [file.ts#L42](file.ts#L42)
- **Problem:** <what is wrong, in one sentence>
- **Evidence:** <quoted offending snippet OR cited rule, e.g. `.github/instructions/typescript-conventions.instructions.md` → "no `as unknown as`">
- **Fix:** <concrete change, ideally as a small before/after diff>
  ```diff
  - const x = something as unknown as Foo;
  + const x = toFoo(something);
  ```
- **Verify:** <one-line check, e.g. "lint passes", "test `foo.spec.ts` still green", "no remaining matches for /<pattern>/">

#### B2 · ...

### Should fix (N)

#### S1 · <title> — [file.ts#L88](file.ts#L88)
- **Problem:** ...
- **Evidence:** ...
- **Fix:** ...
- **Verify:** ...

### Nits / suggestions (N)

#### N1 · <title> — [file.ts#L120](file.ts#L120)
- **Problem:** ...
- **Fix:** ...

### Looks good
- <one-line summary of what was reviewed and passed>
````

**Rules for the report:**

- **Stable IDs (`B1`, `S2`, `N3`)** so the fix step can reference them.
- **Group by severity, not by file.** Blocking = bugs, security, broken contracts. Should fix = convention violations, clear smells. Nits = style, minor improvements.
- **Use clickable line links** (`[path#L42](path#L42)`).
- **Quote the rule** when a workspace convention is violated.
- **Provide a concrete fix.** "This could be cleaner" is useless. Say _what_ and _how_, ideally as a small diff. If a fix is non-trivial or has trade-offs, mark the finding with `**Manual:** <reason>` and skip it during step 5.
- **Provide a `Verify` line** for every Blocking and Should-fix finding so the fix step has a pass/fail signal.
- If everything passes, say so plainly with a one-line scope summary. No padding, no fix step needed.

## 5. Fix step (default ON; skipped under `report-only`)

After printing the report, delegate execution to `qa-apply-findings`:

1. **Hard precondition — call `manage_todo_list` first.** Per the workspace's delivery checklist, you MUST register a todo list covering: read knowledge → apply fixes → run tests → run lint → docs check → retrospective → commit suggestion. Do not call any edit tool before this list exists.
2. Convert findings into the normalized JSON shape expected by
   `.github/skills/qa-apply-findings/findings.schema.json`.
3. Run `qa-apply-findings` to apply `blocking` first, then `should-fix` findings.
4. Reuse the skill's validation contract and summary template at
   `.github/skills/qa-apply-findings/summary.template.md`.
5. If needed, append the existing human-readable recap:

   ```
   ## QA Fix Summary
   - Applied: B1, B2, S1, S3 (4 findings)
   - Deferred (manual): S2 — <one-line reason>
   - Deferred (nit, not in scope): N1, N2
   - Validation: lint ✅, test ✅ (3225 passed), build ✅
   - Files touched: <list>

   📦 **Good commit point:** <type(scope): subject suggestion>
   ```

If any validation fails, **stop, report the failure, and do not attempt destructive recovery.** Leave the partial fixes in the working tree for the user to inspect — the same way a CI failure on a PR would.

## 6. Hard rules — never violate

- Do **not** run `git commit`, `git push`, `gh pr *`, or any remote-mutating command. Suggest commit messages in chat; the user runs `git commit` themselves.
- Do **not** stage or unstage files (`git add`, `git reset`, `git restore --staged`).
- Do **not** "improve" code beyond the reported findings. If you spot something during the fix step that wasn't in the report, add it as a follow-up bullet under the summary instead of silently editing.
- Do **not** disable lint/type rules to make a finding "go away" — fix the underlying issue.
- Do **not** skip the convention-loading step (§2). Workspace rules are the entire reason this runs locally instead of waiting for the PR reviewer.
- Do **not** edit files under `node_modules`, `dist`, `build`, `coverage`, `.nx`, or any generated tree.
