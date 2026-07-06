---
description: 'Local pre-commit code review **and fix**. Reviews the target scope (file, folder, uncommitted changes, or the whole branch vs its base), produces an actionable findings list, then applies the fixes — same loop as opening a PR, getting Copilot review comments, and having an agent address them, but entirely local. Append `report-only` to skip the fix step.'
argument-hint: '[optional file/folder path | "branch [base-ref]"] [optional "report-only"]'
agent: 'agent'
---

# QA Review + Fix

End-to-end local quality loop:

1. **Review** the target scope with the same rigor as the GitHub Copilot PR reviewer.
2. **Report** findings in a normalized format that can be executed by the shared `qa-apply-findings` skill.
3. **Fix + validate** by delegating to `qa-apply-findings` (execution core shared with `/pr-qa`).
4. **Summarize** what was changed, what was left, and why.

The user runs this _before_ committing so problems are caught locally instead of waiting for the PR reviewer.

---

## 1. Parse the argument

`${input:target}` may contain:

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

### Security (OWASP-aware)

- Injection (SQL, command, prompt, XSS via `dangerouslySetInnerHTML`, `innerHTML`, `eval`).
- Hard-coded secrets, tokens, credentials, connection strings.
- Unsafe deserialization, path traversal (`../`), SSRF in fetch/HTTP calls.
- Missing authn/authz checks on new endpoints or tool surfaces.
- Logging of sensitive data (PII, tokens).
- Dependency additions: flag any new package and call out if it looks unmaintained / typosquatted.

### Workspace conventions

- File/folder naming, public-API boundaries (no deep imports into `internal/`, `src/lib/...`).
- Forbidden patterns called out in instruction files (e.g. `as unknown as`, `T[]` vs `Array<T>`).
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
bunx fallow health --file <path> --format json > tmp/fallow-audit.json
# or for dead-code:
bunx fallow dead-code --format json > tmp/fallow-audit.json
```

**For full working-tree scope** (uncommitted changes):

```bash
bunx fallow --format json > tmp/fallow-audit.json
```

After running, read `tmp/fallow-audit.json` and extract findings. Map to report severity:

| fallow `severity`                                                       | Report tier                                     | Condition |
| ----------------------------------------------------------------------- | ----------------------------------------------- | --------- |
| `critical` and `introduced: true` (in audit)                            | **Blocking** if CRAP > 200, else **Should fix** |
| `high` and `introduced: true`                                           | **Should fix**                                  |
| `moderate`                                                              | **Nit**                                         |
| dead-code (`unused-export`, `unused-file`) in `libs/grid/src/public.ts` | **Blocking**                                    |
| dead-code elsewhere                                                     | **Should fix**                                  |
| `circular-dependencies`                                                 | **Blocking**                                    |

Filter out findings in `libs/grid/scripts/`, `tools/`, `demos/`, and `apps/docs/` with CRAP < 900 (these have relaxed thresholds per `.fallowrc.json`). Include all others.

Each fallow finding becomes one report item with the fallow `path:line` as the location. Quote the fallow `description` as the Problem and use the `actions[0].description` as the Fix suggestion.

### Documentation accuracy (treat prose as untrusted)

Any prose added or modified by the diff — code comments, JSDoc, README, knowledge `DECIDED` entries, `@deprecated`/`@since` notes — is **not** authoritative narration of the code. Verify each prose claim against the actual implementation. This is the defect class the GitHub Copilot reviewer catches most consistently.

For every modified or new prose block:

1. **Within the same file:** read the body of the function/class/field the prose describes and confirm it matches. Watch negations ("does NOT track"), enumerations ("excludes a, b, and c"), and version claims.
2. **Cross-file:** if prose claims behavior elsewhere ("plugin X no longer needs Y"), `grep` for the symbol and verify.
3. **Against package state:** version strings in `@deprecated`/`@since` must match `package.json`.
4. **Knowledge files:** `DECIDED` entries are contracts. If a `DECIDED` claim contradicts code in scope, flag it explicitly and say which side you believe is correct (the entry usually wins; the diff under review may be the legitimate update).

When prose disagrees with code, treat it as **Should fix** at minimum (**Blocking** if on a public API surface).

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
