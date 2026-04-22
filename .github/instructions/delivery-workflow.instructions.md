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

Every feature, fix, or refactor must complete **all six steps** before it is considered done:

1. **Read knowledge files** — Before editing grid or adapter code, read the relevant `.github/knowledge/*.md` files (`grid-core`, `grid-plugins`, `grid-features`, `adapters`, `build-and-deploy`, `data-flow-traces`). Rebuild the mental model and check for `DECIDED` entries that might be contradicted by the proposed change. Exempt only for typo/comment/formatting edits.
2. **Implement the code** — Write the feature or fix following the project's architecture and conventions.
3. **Write/update tests** — If the change **can** be tested, it **must** be tested. Add unit tests (co-located) and integration tests as needed; ensure all existing tests still pass. The only valid reason to skip tests is when the change is purely non-functional (e.g., comment-only, formatting, or documentation-only changes).
4. **Verify the build** — Run `bun nx build grid` (check bundle budget), `bun nx test grid`, and `bun nx lint grid`; fix any failures.
5. **Update documentation** — If the change affects behavior, API surface, CSS variables, defaults, or user-visible functionality, documentation **must** be updated. Use the `docs-update` skill for the full checklist (MDX pages, READMEs, llms.txt, llms-full.txt, copilot-instructions, TypeDoc regeneration). The only valid reason to skip docs is when the change has zero user-visible impact (e.g., internal refactor with no behavior change).
6. **Retrospective + knowledge-base update** — Use the `retrospective` skill. If the task revealed a new invariant, state-ownership fact, data-flow edge, design decision, or tension, add it to the matching `.github/knowledge/*.md` file using the structured notation (`OWNS / READS FROM / WRITES TO / INVARIANT / FLOW / TENSION / DECIDED`). Cross-cutting lessons (conventions, workflows, tool tricks) go to the most appropriate instruction or skill file. Explicitly state "no new knowledge" if nothing emerged — never silently skip.

Do **not** consider work complete until all six steps are finished. Skipping steps is not acceptable. When in doubt about whether tests or docs are needed, **default to including them**.

### Enforcement

#### Rule 1 — Todo list is a hard precondition

**Before calling any file-editing or code-running tool** (including `create_file`, `replace_string_in_file`, `multi_replace_string_in_file`, `edit_notebook_file`, `run_in_terminal` for code execution), you **MUST** first call `manage_todo_list` with the seven delivery steps:

1. **Read knowledge files** — load the `.github/knowledge/*.md` files covering the affected domain (grid-core, grid-plugins, grid-features, adapters, build-and-deploy, data-flow-traces). Skip only for pure typo/comment/formatting edits.
2. Implement
3. Test (write/update + run)
4. Build & lint (`bun nx build <project>`, `bun nx lint <project>`)
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

In all other cases the step must be executed.

#### Rule 3 — Self-audit before the final message

Before your final message to the user, re-read the todo list. For each step marked completed, state in **one concrete sentence** what was done (e.g. "Ran `bun nx test grid` — 3225 passed" not "tests pass"). If you cannot produce a concrete sentence for a step, it was not actually completed — go back and do it before responding.

The final message must end with the commit suggestion from the Commit Hygiene section. This is not optional — every completed task ends with `📦 **Good commit point:** ...`.

## Git Safety Rules — NEVER push, merge, or modify remote state

**Agents MUST NOT execute any command that publishes, merges, or alters state on a remote (`origin`, GitHub, etc.) unless the user has explicitly asked for that specific operation in the current turn.** Local commits are fine; anything that touches the remote is not.

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

- `git add`, `git commit`, `git restore`, `git stash`
- `git checkout <existing-local-branch>`, `git switch -c <new-local-branch>`
- `git merge` / `git rebase` between **local** branches when the user asked
- `git branch -d <local-branch>` (only if the user asked for the cleanup)

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
type(scope): short description

[optional body with more detail]
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `build`, `chore`, `perf`
**Scopes:** `grid`, `grid-angular`, `grid-react`, `themes`, `docs`, `demo`

**Documentation-only commits must use `docs` type** — e.g. `docs(grid): clarify event naming in Angular examples`. Never use `feat` or `fix` for changes that only touch documentation files (MDX, README, llms.txt, llms-full.txt). Using `feat`/`fix` with a library scope triggers release-please to create a release for that library even though no code changed.

**Prompt format:** After completing a logical unit of work, suggest:

> 📦 **Good commit point:** `type(scope): description`

## Adding a New Feature to Grid (or any library)

1. **Define types** in `types.ts` (public) or as inline types (internal)
2. **Implement logic** in appropriate `internal/*.ts` module (keep pure functions testable)
3. **Add unit tests** co-located with source file (e.g., `feature.ts` → `feature.spec.ts`)
4. **Add integration test** in `src/__tests__/integration/` if it requires full component lifecycle
5. **Create demo** in `apps/docs/src/components/demos/` demonstrating the feature
6. **Export public API** in `src/public.ts` if exposing new types/functions
