---
applyTo: '{libs,apps,demos}/**'
---

# Delivery Workflow

## Delivery Checklist

**This checklist applies to every change — no matter how small.** A one-line bug fix, a CSS tweak, and a multi-file feature all follow the same process. There are no exemptions based on request size, perceived simplicity, or urgency.

Every feature, fix, or refactor must complete **all five steps** before it is considered done:

1. **Implement the code** — Write the feature or fix following the project's architecture and conventions
2. **Write/update tests** — If the change **can** be tested, it **must** be tested. Add unit tests (co-located) and integration tests as needed; ensure all existing tests still pass. The only valid reason to skip tests is when the change is purely non-functional (e.g., comment-only, formatting, or documentation-only changes)
3. **Verify the build** — Run `bun nx build grid` (check bundle budget), `bun nx test grid`, and `bun nx lint grid`; fix any failures
4. **Update documentation** — If the change affects behavior, API surface, CSS variables, defaults, or user-visible functionality, documentation **must** be updated. Use the `docs-update` skill for the full checklist (MDX pages, READMEs, llms.txt, llms-full.txt, copilot-instructions, TypeDoc regeneration). The only valid reason to skip docs is when the change has zero user-visible impact (e.g., internal refactor with no behavior change)
5. **Retrospective** — Use the `retrospective` skill to capture lessons learned and improve instructions/skills

Do **not** consider work complete until all five steps are finished. Skipping steps is not acceptable. When in doubt about whether tests or docs are needed, **default to including them**.

### Enforcement

**At the start of every task**, create a todo list with all five delivery steps before writing any code. Mark each step in-progress/completed as you go. Do **not** suggest a commit or report completion until every step shows completed. This is non-negotiable — the todo list is the mechanism that prevents steps from being forgotten.

## Commit Hygiene

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

**Prompt format:** After completing a logical unit of work, suggest:

> 📦 **Good commit point:** `type(scope): description`

## Adding a New Feature to Grid (or any library)

1. **Define types** in `types.ts` (public) or as inline types (internal)
2. **Implement logic** in appropriate `internal/*.ts` module (keep pure functions testable)
3. **Add unit tests** co-located with source file (e.g., `feature.ts` → `feature.spec.ts`)
4. **Add integration test** in `src/__tests__/integration/` if it requires full component lifecycle
5. **Create demo** in `apps/docs/src/components/demos/` demonstrating the feature
6. **Export public API** in `src/public.ts` if exposing new types/functions
