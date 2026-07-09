---
applyTo: '{libs,apps,demos}/**'
---

# Delivery Workflow

## Issue Evaluation (Step 0)

**Before implementing any GitHub issue or feature request**, critically evaluate whether the proposed API or change belongs in the library. Do not uncritically implement what an issue asks for — issues describe a _want_, not necessarily the right solution.

**Ask these three questions:**

1. **Does it require internal state** that consumers don't already have access to via existing public API?
2. **Does it encapsulate non-trivial logic** that is genuinely error-prone to reimplement?
3. **Does it serve the majority of consumers**, not just a niche use case?

If the answer to all three is **no**, the method/feature likely belongs in consumer-level utility code, not in the library. Push back on the issue with a comment explaining why.

**Common red flags for rejection:**

- **Trivially derivable** — can be written in 1–3 lines using existing API methods
- **Hardcoded locale strings** — library APIs must not embed English UI text (`'All'`, `'None'`, `'+N more'`); this is an i18n anti-pattern
- **Hot-path cost for niche features** — adding work to `processRows()` or render paths for features most consumers won't use
- **Redundant getters** — a method that returns `someOtherMethod() !== 'defaultValue'` doesn't warrant its own API entry

**When evaluating, comment your findings** on the GitHub issue before starting implementation. If only part of an issue has library value, implement just that part and explain the exclusions.

## Delivery Checklist

**This checklist applies to every change — no matter how small.** A one-line bug fix, a CSS tweak, and a multi-file feature all follow the same process. There are no exemptions based on request size, perceived simplicity, or urgency.

> **Saving mode (`ai_mode: saving`) — defer credit-heavy steps to the user.** When the `ai_mode` flag (the active source of truth is `.github/instructions/ai-mode.instructions.md`, auto-loaded every session) is `saving`, still create the todo list and implement the change, but do **not** execute the credit-heavy steps yourself:
>
> - **Step 3 (Test)** and **Step 4 (Build & lint)** — do not run them. Instead, give the user the exact command to run (e.g. `bun nx run-many -t lint test build --projects=<project>`) and mark each step **completed with a "deferred to user (saving mode)"** note. This is an additional allowed reason to mark these steps without executing them, beyond the N/A cases listed in Rule 2.
> - **Debugging / profiling / e2e** — do not initiate autonomously; hand off with the command.
> - **Steps 1, 5, 6** — keep them lightweight: read only the knowledge files strictly needed for the edit, and state "no new knowledge" / "no user-visible change" rather than spending tokens to confirm.
> - Do not expand scope beyond the literal request. Still end with the Step 7 commit suggestion.
>
> In `full` mode (default), execute all seven steps as written below.

### Quick reference

| #   | Step                                  | Default action                                                                                                                                                    | Skip allowed only when…                                                |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Read knowledge files                  | Load relevant `.github/knowledge/*.md` files for the affected domain.                                                                                             | Pure typo / comment / formatting edit.                                 |
| 2   | Implement                             | Write the code change.                                                                                                                                            | Never.                                                                 |
| 3   | Test                                  | Add/update co-located unit and integration tests; rerun the suite.                                                                                                | Change is purely non-functional (comment-only, formatting, docs-only). |
| 4   | Build & lint                          | Run all three targets in parallel: `bun nx run-many -t lint test build --projects=<project>` (or `bun nx affected -t lint test build` for cross-project changes). | Never.                                                                 |
| 5   | Docs update                           | Apply the `docs-update` skill (MDX, READMEs, llms.txt, llms-full.txt, copilot-instructions, TypeDoc).                                                             | Change has zero user-visible impact.                                   |
| 6   | Retrospective + knowledge-base update | Apply the `retrospective` skill; record any new INVARIANT/DECIDED/etc.                                                                                            | No new lesson emerged — state "no new knowledge" explicitly.           |
| 7   | Suggest commit                        | End the final message with `📦 **Good commit point:** type(scope): … (#issue)` (drop `(#issue)` when there is no issue).                                          | Never.                                                                 |

Every feature, fix, or refactor must complete **all seven steps** before it is considered done. The detailed expectations for each step follow.

1. **Read knowledge files** — Before editing grid or adapter code, read the relevant `.github/knowledge/*.md` files (`grid-core`, `grid-plugins`, `grid-features`, `adapters`, `build-and-deploy`, `data-flow-traces`). Rebuild the mental model and check for `DECIDED` entries that might be contradicted by the proposed change. Exempt only for typo/comment/formatting edits.
2. **Implement the code** — Write the feature or fix following the project's architecture and conventions.
3. **Write/update tests** — If the change **can** be tested, it **must** be tested. Add unit tests (co-located) and integration tests as needed; ensure all existing tests still pass. The only valid reason to skip tests is when the change is purely non-functional (e.g., comment-only, formatting, or documentation-only changes).
4. **Verify the build** — Run lint, test, and build **in parallel** with a single command: `bun nx run-many -t lint test build --projects=grid` (or `bun nx affected -t lint test build` when the change spans multiple projects). Nx parallelizes the targets, attributes each line of output to its project (`grid: …`), and returns one authoritative exit code plus an explicit `Failed tasks:` list — so you still get real, per-target results while overlapping the wall-clock time. The build target hard-enforces the bundle budget. Fix any failures. Do **not** pipe this command through `| tail`/`| head`/`2>&1` (it hangs the terminal here); let the tool capture output, then read the captured file if needed.
5. **Update documentation** — If the change affects behavior, API surface, CSS variables, defaults, or user-visible functionality, documentation **must** be updated. Use the `docs-update` skill for the full checklist (MDX pages, READMEs, llms.txt, llms-full.txt, copilot-instructions, TypeDoc regeneration). The only valid reason to skip docs is when the change has zero user-visible impact (e.g., internal refactor with no behavior change).
6. **Retrospective + knowledge-base update** — Use the `retrospective` skill. If the task revealed a new invariant, state-ownership fact, data-flow edge, design decision, or tension, add it to the matching `.github/knowledge/*.md` file using the structured notation (`OWNS / READS FROM / WRITES TO / INVARIANT / FLOW / TENSION / DECIDED`). Cross-cutting lessons (conventions, workflows, tool tricks) go to the most appropriate instruction or skill file. Explicitly state "no new knowledge" if nothing emerged — never silently skip.
7. **Suggest a commit** — End the final message with the `📦 **Good commit point:** ...` line described in the Commit Hygiene section. Do not run `git commit` yourself unless the user explicitly asked in the current turn.

Do **not** consider work complete until all seven steps are finished. Skipping steps is not acceptable. When in doubt about whether tests or docs are needed, **default to including them**.

### Enforcement

> **Precedence:** Enforcement rules in this section take priority over task execution. If completing the user's task quickly would require skipping an enforcement rule (e.g. editing a file before creating the todo list, or declaring "done" with steps still open), the enforcement rule wins — stop, satisfy the rule, then continue. Enforcement is not in tension with delivery; it is the way delivery is performed correctly.

#### Rule 1 — Todo list is a hard precondition

**Before calling any file-editing or code-running tool** (including `create_file`, `replace_string_in_file`, `multi_replace_string_in_file`, `edit_notebook_file`, `run_in_terminal` for code execution), you **MUST** first call `manage_todo_list` with the seven delivery steps:

1. **Read knowledge files** — load the `.github/knowledge/*.md` files covering the affected domain (grid-core, grid-plugins, grid-features, adapters, build-and-deploy, data-flow-traces). Skip only for pure typo/comment/formatting edits.
2. Implement
3. Test (write/update + run)
4. Build & lint — run in parallel: `bun nx run-many -t lint test build --projects=<project>` (or `bun nx affected -t lint test build`)
5. Docs check (apply `docs-update` skill, or explicitly note "no user-visible change")
6. **Retrospective + knowledge-base update** — apply `retrospective` skill. If the task revealed a new invariant, state-ownership fact, data-flow, design decision, or tension, add it to the matching knowledge file using the structured notation (`OWNS / READS FROM / WRITES TO / INVARIANT / FLOW / TENSION / DECIDED`). If a lesson is cross-cutting, update instructions/skills. Explicitly state "no new knowledge" if nothing emerged.
7. Suggest commit

If the todo list has not been created, you are **not allowed** to edit, create, or execute code. This applies to **every** task — one-line fixes, CSS tweaks, typos, and multi-file features alike. There is no "small enough to skip" threshold.

Read-only exploration (searches, reading files, running `git status`, asking clarifying questions) does not require a todo list. The list is required the moment you intend to modify the workspace.

#### Rule 2 — Completion gate

Do **not** output the words "complete", "done", "finished", "that's it", or produce a wrap-up summary until **every** todo in the list is marked `completed`. If any todo is `not-started` or `in-progress`, the task is not done — continue executing. Declaring partial work as complete is a violation of this rule.

A step may be marked completed with "N/A" only in these specific cases:

- **Test** — the change is purely non-functional (comment-only, formatting, pure documentation edit)
- **Docs** — the change has zero user-visible impact (internal refactor, test-only change, build config)
- **Retrospective** — no new lesson emerged (state this explicitly; do not silently skip)

Additionally, when `ai_mode: saving` (see the "Saving mode" note above), **Test** and **Build & lint** may be marked completed with a "deferred to user (saving mode)" note instead of being executed — hand the user the exact command to run.

In all other cases the step must be executed.

#### Rule 3 — Self-audit before the final message

Before your final message to the user, re-read the todo list. For each step marked completed, state in **one concrete sentence** what was done (e.g. "Ran `bun nx test grid` — 3225 passed" not "tests pass"). If you cannot produce a concrete sentence for a step, it was not actually completed — go back and do it before responding.

The final message must end with the commit suggestion from the Commit Hygiene section. This is not optional — every completed task ends with `📦 **Good commit point:** ...`.

## Git Safety Rules — NEVER push, merge, or modify remote state

**Agents MUST NOT execute any command that publishes, merges, or alters state on a remote (`origin`, GitHub, etc.) unless the user has explicitly asked for that specific operation in the current turn.** Local commits are fine; anything that touches the remote is not.

### Tooling: `gh`/`git` CLI only — never GitKraken

The user has **no GitKraken license**. The GitKraken MCP tools (`mcp_gitkraken_cli_*`) and GitLens MCP tools are **off-limits for every operation** — including read-only ones like status, log, diff, blame, branch listing, and PR/issue lookups. Use the **`gh` CLI** for all GitHub operations (issues, PRs, releases, reviews, comments) and the **`git` CLI** for all local repository operations. The VS Code `github-pull-request_*` read tools may be used for read-only PR/issue lookups. This tooling restriction is independent of the consent rules below: even an allowed read-only operation must go through `gh`/`git`, and remote-mutating operations still require explicit per-request consent.

### Forbidden without explicit per-request user consent

The following commands are **forbidden** unless the user has, in the current turn, asked for that exact action by name:

- `git push` (any form, including `git push origin <branch>`, `git push --force`, `git push -u`)
- `git push --tags`
- `gh pr create`, `gh pr merge`, `gh pr edit`, `gh pr review --approve`
- `gh release create`, `gh repo edit`
- Any `github-pull-request_*` tool that writes (e.g. `create_pull_request`, `resolveReviewThread`, merge actions)
- `git branch --set-upstream-to=origin/<x>`, `git remote add/set-url`
- Anything that mutates a tag, branch, or PR on the remote

"Implicit consent" does not exist. A request like _"finish this work"_ or _"commit this"_ is **only** consent for local commits. It is **not** consent to push or open a PR. If you are unsure, **stop and ask** with a one-line confirmation prompt before running the command.

### Always allowed (read-only)

- `git status`, `git log`, `git diff`, `git show`, `git branch -v`
- `git fetch` (read-only — updates local refs but does not modify remote)
- `gh pr view`, `gh pr list`, `gh pr diff`, `gh pr status`
- `gh repo view`
- Any `github-pull-request_*` tool that only reads

### Always allowed (local writes)

- `git add`, `git restore`, `git stash`
- `git checkout <existing-local-branch>`, `git switch -c <new-local-branch>`
- `git merge` / `git rebase` between **local** branches when the user asked
- `git branch -d <local-branch>` (only if the user asked for the cleanup)

### Requires explicit user request

- **`git commit`** — Do **not** run `git commit` on the user's behalf. The delivery checklist's final step is to **suggest** a commit message (`📦 **Good commit point:** ...`), not to execute it. The user runs the commit. Only run `git commit` yourself when the user has explicitly asked in the current turn (e.g. _"commit this"_, _"go ahead and commit"_). A user request to "finish the work" or "fix the failing test" is **not** consent to commit.

### Branch discipline

- **Never commit directly to `main`.** If you find yourself on `main` and need to commit, first `git switch -c <topic-branch>` and inform the user. Direct commits to `main` are a violation of this rule even if no push happens.
- **Never delete or overwrite a branch you did not create in the current turn.** A user-created or previously-existing topic branch is the user's working state — leave it alone.
- If the user asks for a commit, the commit goes on whatever branch is currently checked out. If that branch is `main`, **stop and ask** which topic branch to use.

### Recovery, not concealment

If you accidentally execute a forbidden remote operation, **stop immediately, tell the user exactly what was pushed, and offer the revert command** (e.g. `git push --force-with-lease origin <sha>:<branch>` to reset, or `gh pr close` to close a PR). Do not paper over the mistake.

### Why this rule exists

Auto-pushing or auto-merging removes the user's review opportunity. The user is the only authority on what reaches `origin`. Agent-created branches are drafts; only the user decides when (and if) they become public history.

Prompt the user to commit at logical stopping points. Small, focused commits are preferred.

**Before suggesting a commit, review documentation** — use the `docs-update` skill for the full checklist.

**When to suggest a commit:**

- After each discrete bug fix
- After adding or modifying a single feature
- After updating tests for a specific change
- After documentation updates
- After refactoring a single module or function
- After fixing build/config issues

**Commit message format (Conventional Commits):**

```
type(scope): short description (#issue)

[optional body with more detail]
```

The `(scope)` — also called the **domain** — names the affected part of the system (see the Scopes section below). The trailing `(#issue)` references the GitHub issue the commit closes or relates to, e.g. `fix(grid/clipboard): restore focus after paste (#200)`. Include it whenever the work maps to an issue; omit it for issueless chores.

**Types** — pick by the _kind_ of work:

| Work                                                                                        | Type                                                                      |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Source code (behaviour, API, refactor, performance, formatting)                             | `fix` \| `feat` \| `refactor` \| `perf` \| `style` \| `revert` \| `chore` |
| Tests only (unit specs or e2e)                                                              | `test`                                                                    |
| CI, agent workflows, or the build process                                                   | `ci` (pipelines & workflows) or `build` (build tooling/config)            |
| Documentation (docs site, READMEs, `.github/knowledge`, `.github/instructions`, `llms.txt`) | `docs`                                                                    |

`enhance` is also valid — an improvement to existing behaviour that is not a brand-new `feat`. The full set recognised by `changelog-sections` in `release-please-config.json` is the source of truth.

### Scopes — one of a fixed set, or none

The scope is **always one of a fixed, small set**, matched by where the changed **code** lives. Never invent anything else.

| Scope           | Code location                                                           |
| --------------- | ----------------------------------------------------------------------- |
| `grid`          | `libs/grid/**` outside `plugins/` — core, features, internal, styles    |
| `<plugin-name>` | `libs/grid/src/lib/plugins/<name>/**` — the plugin folder name, exactly |
| `grid-angular`  | `libs/grid-angular/**`                                                  |
| `grid-react`    | `libs/grid-react/**`                                                    |
| `grid-vue`      | `libs/grid-vue/**`                                                      |

**Anywhere else → OMIT the scope entirely** (bare `type:`, no parentheses). This covers the docs site (`apps/docs/**`), knowledge & instruction files (`.github/**`), e2e suites (`e2e/**`, `apps/docs-e2e/**`), demos (`demos/**`), themes (`libs/themes/**`), and tooling / root config. Do **not** invent scopes like `docs`, `e2e`, `demo`, `themes`, `tooling`, `repo`, `meta`, or a feature name — if the work is not core grid, a plugin, or an adapter, there is no scope.

Examples:

- `fix(grid): correct viewport height calculation`
- `feat(clipboard): carry structured payload for cross-window paste`
- `fix(grid-react): forward ref to host element`
- `docs: add data-flow-traces knowledge file` — knowledge file → no scope
- `docs: fix broken theming guide link` — docs-site page → no scope
- `test: add cross-framework filter e2e spec` — e2e → no scope
- `chore: bump employee-management demo deps` — demo → no scope
- `build: tighten bundle budget warning` — tooling → no scope

> **Plugin scope = folder name, exactly.** Lowercase, kebab-case, as it appears under `libs/grid/src/lib/plugins/<name>/`. Do **not** scope a plugin change as `grid` just because it lives inside the grid package — that loses the signal in the changelog.

**Chained (multi-system) scopes:**

When a single commit legitimately spans multiple parts of the system, chain the allowed scopes with **`/`** (slash), NOT commas. Order alphabetically when listing peer plugins so the form is deterministic; when mixing core with plugins, list `grid` first to read as "core plus these plugins":

- `fix(grid/sort): handle sort reset when columns array changes`
- `feat(filter/sort): unify operator metadata shape`
- `refactor(grid-react/grid-vue): share event-name normalizer`

> **Why `/` not `,`** — Conventional Commits does not formally define multi-scope. release-please tokenises a comma-separated scope as a **list** of scopes and then matches the commit against each package's scope filter independently, which produces **duplicate CHANGELOG entries** (the same commit appears twice in every affected package). A `/`-separated scope is treated as one opaque string and matched once; per-package bumps fall back to path-based detection (release-please-config's `packages` map), which is what we want anyway. The rendered changelog line is identical (`**grid/sort:** ...` vs `**grid,sort:** ...`), so this is purely a parser workaround at zero readability cost.

Prefer splitting commits over long chains. If a commit needs more than ~3 scopes, it is probably doing too much — break it up. When the cross-cutting effect is best explained in prose, prefer **single scope + body**:

```
fix(grid): honor gridConfig.features in dedup and template bridges

Also touches grid-react and grid-angular template bridges.
```

— release-please bumps the other packages from the file paths in the diff and the per-package CHANGELOG attribution stays clean.

**Documentation-only commits use `docs` with NO scope** — even a page about a specific plugin. Docs live outside the scoped code, and `docs` commits are hidden in the changelog, so a scope would carry no signal (and a library scope on a non-`docs` type would wrongly trigger a release).

| Change                                     | Correct                                  | Wrong                                 |
| ------------------------------------------ | ---------------------------------------- | ------------------------------------- |
| MDX page about the sort plugin             | `docs: clarify multi-sort behavior`      | `docs(sort): ...` / `feat(sort): ...` |
| README for `@toolbox-web/grid-angular`     | `docs: document grid-angular signal API` | `docs(grid-angular): ...`             |
| New knowledge file in `.github/knowledge/` | `docs: add data-flow-traces`             | `docs(grid): ...` / `docs(repo): ...` |
| Astro/Starlight config in `apps/docs/`     | `docs: upgrade Starlight to 0.38`        | `docs(docs): ...`                     |

Never use `feat`/`fix` for changes that only touch documentation, knowledge, or instruction files — a library scope with `feat`/`fix` triggers release-please to release that library even though no code changed.

**Prompt format:** After completing a logical unit of work, suggest:

> 📦 **Good commit point:** `type(scope): description`

## Adding a New Feature to Grid (or any library)

1. **Define types** in `types.ts` (public) or as inline types (internal)
2. **Implement logic** in appropriate `internal/*.ts` module (keep pure functions testable)
3. **Add unit tests** co-located with source file (e.g., `feature.ts` → `feature.spec.ts`)
4. **Add integration test** in `src/__tests__/integration/` if it requires full component lifecycle
5. **Create demo** in `apps/docs/src/components/demos/` demonstrating the feature
6. **Export public API** in `src/public.ts` if exposing new types/functions
