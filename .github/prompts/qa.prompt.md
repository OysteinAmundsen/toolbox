---
description: 'Local pre-commit code review. Run before committing to catch bugs, security issues, and convention violations — same checks as the GitHub Copilot PR reviewer, but without pushing. Accepts a file path, folder path, or no argument (reviews uncommitted changes).'
argument-hint: '[optional file or folder path; defaults to uncommitted changes]'
agent: 'agent'
---

# QA Review

Perform a thorough code review of the target scope. Match the rigor of the GitHub Copilot PR reviewer, but run entirely locally so the user can fix issues **before** committing.

## 1. Determine scope

Resolve `${input:target}` (the prompt argument) using this precedence:

1. **Argument is a file path** → review just that file.
2. **Argument is a folder path** → review every source file under it (recursive, excluding `node_modules`, `dist`, `build`, `coverage`, `.nx`, generated code).
3. **Argument is empty / not provided** → review the uncommitted working tree:
   - Run `git status --porcelain` to list modified, added, and untracked files.
   - Run `git diff --staged` and `git diff` to see exactly what changed.
   - For new (untracked) files, read the file in full.
   - Focus the review on **what changed**, not the whole file — but read enough surrounding context to judge correctness.

If the working tree is clean and no argument was given, report that and stop.

## 2. Load workspace conventions

Before reviewing, load the relevant convention sources for the files in scope:

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

- File/folder naming (kebab-case, `use-` prefix for hooks, `.styles.ts` co-location, etc.).
- Import paths (workspace aliases vs relative), public-API boundaries (no deep imports into `internal/`, `src/lib/...`).
- Forbidden patterns called out in instruction files (e.g. `as unknown as`, `T[]` vs `Array<T>`, styled components inside render bodies, missing `data-testid`, hand-written hooks where a generated one exists).
- Generated/legacy preferences (e.g. prefer `@cargo-list/api-gen` over `@cargo-list/api`).
- Test conventions (co-located `*.spec.ts`, `waitUpgrade()`, no skipped tests left behind).

### Best practices

- Single-responsibility; functions doing too much.
- Public API additions: are types stable, named consistently, documented?
- Error handling at boundaries only — no defensive try/catch around impossible cases.
- React: stable hook dependencies, memoization where it matters, keys not using array index.
- CSS: tokens over hardcoded values, no `!important` without justification.
- Performance hotspots: synchronous work in render, unbounded loops, N+1 fetches.

### Hygiene

- Leftover `console.log`, `debugger`, `TODO`/`FIXME` without an issue link, commented-out code.
- Stale or contradictory comments.
- Missing or inappropriate `data-testid` on new visual components (workspace rule).
- Bundle-budget risk for `libs/grid/**` changes (toolbox workspace) — flag if change looks heavy.

### Documentation accuracy (treat prose as untrusted)

Any prose added or modified by the diff — code comments, JSDoc, README sections,
`.github/knowledge/*.md` `DECIDED` entries, `@deprecated` notes, version
strings — is **not** authoritative narration of the code. Verify each prose
claim against the actual implementation. This is the class of defect the
GitHub Copilot reviewer catches most consistently and the easiest one for a
human reviewer to gloss over because the surrounding code "looks right".

For every modified or new prose block:

1. **Within the same file:** read the body of the function/class/field the
   prose describes and confirm the prose matches it. Pay particular
   attention to negations ("does NOT track", "is now a no-op", "no longer
   installs"), enumerations ("excludes a, b, and c"), and version claims
   ("Since 1.34.0", "@deprecated").
2. **Cross-file:** if the prose makes a claim about behavior elsewhere
   ("the X plugin no longer needs to install Y", "callers should use Z
   instead"), `grep` for the referenced symbol/option across the codebase
   and verify the claim. A JSDoc that says "X is a no-op" is wrong if any
   file still branches on X.
3. **Against package state:** version strings in `@deprecated`/`@since`
   tags must match `package.json`. "Will be removed in a future major
   release" is fine; specific version numbers must be real.
4. **Knowledge files (`.github/knowledge/*.md`):** `DECIDED` entries are
   contracts. If a `DECIDED` entry's claim contradicts the code in scope,
   one of them is wrong — flag it explicitly and say which side you
   believe is correct (the entry usually wins per the workspace's "Read
   gate" rule, but the diff under review may be the legitimate update).

When prose disagrees with code, treat it as a **Should fix** at minimum
(possibly **Blocking** if the prose is on a public API surface and would
mislead consumers).

## 4. Report format

Structure the output as:

```
## QA Review — <scope summary>

### Blocking
- [file.ts:42] <issue>. Why: <one line>. Fix: <suggestion>.

### Should fix
- [file.ts:88] ...

### Nits / suggestions
- [file.ts:120] ...

### Looks good
- <one-line summary of what was reviewed and passed>
```

Rules for the report:

- **Group by severity, not by file.** Blocking = bugs, security, broken contracts. Should fix = convention violations, clear smells. Nits = style, minor improvements.
- **Cite line numbers** (use `file.ts#L42` markdown links so they're clickable in chat).
- **Quote the rule** when a workspace convention is violated, e.g. "violates `.github/instructions/typescript-conventions.instructions.md` — no `as unknown as`".
- **Be specific.** "This could be cleaner" is useless. Say _what_ and _how_.
- **Do not auto-fix.** Report only. The user decides what to apply, then re-runs `/qa` if they want.
- **If everything passes**, say so plainly with a one-line scope summary. No padding.

## 5. Do not

- Do not run `git commit`, `git push`, or any remote-mutating command.
- Do not stage, unstage, or modify files.
- Do not regenerate code, run formatters, or "improve" things on the side.
- Do not skip the convention-loading step — workspace rules are the whole point of running this locally instead of waiting for the PR reviewer.
