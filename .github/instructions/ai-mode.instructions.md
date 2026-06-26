---
applyTo: '**'
description: 'AI usage mode (token budget). Auto-loaded every session; the Current mode line below is the active flag.'
---

# AI Usage Mode — active flag

<!-- Toggle with the /ai_mode prompt. Keeping this change uncommitted makes the flag
     machine-local; committing it shares the mode with the whole team. -->

**Current mode: saving**

Valid values: `full` | `saving`.

## When mode is `saving`

Do the **bare minimum** for the literal request and hand credit-heavy work back to the user.
This overrides the _execution_ of credit-heavy workflow steps; it never relaxes safety/consent
rules.

- Do **not** run tests, lint, builds, or debugging unless explicitly asked. Instead, hand off the
  exact command for the user to run and mark those steps "deferred to user (saving mode)". Handoff
  examples:
  - Tests / build / lint: `bun nx run-many -t lint test build --projects=<project>`
  - Cross-project: `bun nx affected -t lint test build`
- Stop after the implementation edit; do not proactively verify, profile, or expand scope.
- Minimize tool calls, file inspection, and analysis to only what the requested edit strictly
  requires.
- For subagents, pass the cheapest capable model and keep delegation minimal.
- Pause and ask before any operation that would read more than 5 files at once, execute a build
  or test suite, perform a web fetch, or delegate to a subagent expected to run for more than one
  tool-call round-trip.

### Project-specific deferrals (discovered from `delivery-workflow.instructions.md`)

When `saving`, tighten the mandatory delivery checklist as follows — still create the todo list,
implement, and end with the Step 7 commit suggestion, but defer the credit-heavy steps:

- **Step 3 (Test)** and **Step 4 (Build & lint)** — do not run. Hand off
  `bun nx run-many -t lint test build --projects=<project>` (or `bun nx affected -t lint test build`
  for cross-project changes) and mark each step "deferred to user (saving mode)".
- **Debugging / profiling / e2e / benchmarking** — do not initiate autonomously; hand off the
  command (e.g. `bun nx e2e <project>`, `bun run bench`).
- **Steps 1, 5, 6 (knowledge read / docs / retrospective)** — keep lightweight: read only the
  knowledge files strictly needed for the edit, and state "no new knowledge" / "no user-visible
  change" rather than spending tokens to confirm.

## When mode is `full`

Behave with full autonomy: full tool use, debugging, and test/build/lint cycles, exactly as the
project's normal workflow prescribes.

## Safety

This flag only governs token-spend autonomy. It never overrides safety rules (e.g. never push or
merge to a remote without explicit per-request consent).
