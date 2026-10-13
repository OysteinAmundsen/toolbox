# Authoring reference: routing detail, templates, context budget

Loaded from the `retrospective` skill when the quick routing table is not enough, or when you are
about to create/extend an instruction or skill file.

## Inline vs. file placement (detail for Step 2b)

| Medium             | When to use                                                                                    | Example                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Inline comment** | Implementation gotcha tied to a specific line or block; only relevant when reading _this_ code | `// Do NOT remove — getRow() callers need the map before scheduler` |
| **JSDoc**          | Public API contract, non-obvious parameter semantics, or behavior consumers must know about    | `@remarks With a single rowGroupField, isGroup is always false`     |
| **Type-level doc** | Property or type whose name alone is misleading or ambiguous                                   | JSDoc on `PivotRow.isGroup` explaining what "group" really means    |
| **Knowledge file** | Lesson describes how the system works (mental model), not a single line                        | `INVARIANT:` in `grid-render-pipeline.md`                           |
| **Instruction**    | Cross-cutting rule auto-applied to a file glob                                                 | New TS pattern in `typescript-conventions.instructions.md`          |
| **Skill**          | Repeatable multi-step procedure                                                                | A new diagnostic workflow                                           |

If someone would need to leave the file to understand the code, the comment is missing. If the information is useful to consumers (not just maintainers), make it JSDoc.

## Instruction / skill target (detail for Step 2d)

| Lesson Type                 | Target File                                                                  | Example                                          |
| --------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| **Project-wide convention** | `.github/copilot-instructions.md`                                            | New toolchain version, changed project structure |
| **File-type convention**    | `.github/instructions/<topic>.instructions.md`                               | New TS pattern to prefer, CSS convention         |
| **Grid-specific pattern**   | `.github/instructions/grid-*.instructions.md`                                | New pitfall, architecture insight                |
| **Repeatable workflow**     | `.github/skills/<name>/SKILL.md`                                             | Multi-step procedure worth codifying             |
| **Tool/command discovery**  | Existing instruction or skill that uses the tool                             | Better CLI flag, new MCP tool usage              |
| **Pitfall / gotcha**        | `.github/instructions/grid-pitfalls.instructions.md` or relevant instruction | Things that waste time if not known              |

**Before choosing a target**, scan the full list of instruction files in `.github/instructions/`, knowledge files in `.github/knowledge/`, and skill files in `.github/skills/`. The right home is whichever file a future agent would have loaded when it needed the lesson. Grid-pitfalls is appropriate only for gotchas specific to the grid's DOM/render behavior — most lessons belong elsewhere.

## Signals that something is worth a skill

Ask: _did I work out a procedure, command sequence, diagnostic technique, or script that would save the next session real effort?_ Any of these is a yes:

- you wrote a throwaway script, one-liner, or query and had to debug it before it worked
- you discovered a gate, check, or failure mode that the normal workflow does not catch
- you repeated a multi-step investigation you would otherwise have to rediscover
- a tool or command needed non-obvious flags, escaping, or ordering to behave

Before writing a new skill, check whether an existing skill already owns the job — extend it instead of adding a sibling. A throwaway that only made sense for this one task is **not** a skill: say so and move on rather than manufacturing one.

## Templates

### Instruction files (`.instructions.md`)

Always loaded when working on matching files. Keep them **concise** (bullets, not paragraphs), **actionable** ("Do X" not "X is a thing"), and **correct** (verify before writing).

```markdown
---
applyTo: '<glob-pattern>'
---

# Title

- **Rule name**: Brief actionable rule
```

### Skill files (`SKILL.md`)

Loaded on demand; can hold step-by-step workflows, templates, reference tables, verification criteria.

```markdown
---
name: skill-name # must equal the folder name; lowercase, digits, hyphens
description: What it does AND when to use it (≤1024 chars; this is what the agent matches on).
argument-hint: <required-arg> [optional-arg]
# disable-model-invocation: true  # manual /slash-command only
# user-invocable: false           # hidden from the / menu; agent-loaded only
---

# Title

## Step 1: ...
```

- **Slash-command arguments are not substituted.** Skills have no `${input:…}` / `$ARGUMENTS` variables (that is prompt-file syntax). Write "the text after `/<skill-name>`" and let the agent parse it; describe the shape in `argument-hint`.
- **Keep `SKILL.md` lean; move bulky reference into sibling `.md` files** in the skill folder and link them with "read X when Y". Only `name` + `description` are always in context; the body loads on invocation, sibling files only when read.

**Skill-private scripts — keep the skill self-contained:**

- If a script is used **only** by one skill (not by Nx, CI, Vite, or the build), place it **inside the skill folder** (e.g. `.github/skills/<name>/analyze-trace.mjs`) and reference it by that path.
- If a script is **shared infrastructure** — invoked by CI, an Nx target, Vite, or the build — it stays in `tools/` (or `libs/*/scripts/`) and the skill **references** it. Do NOT copy it into the skill folder; a second copy will drift. Example: `tools/build-size-report.ts` is run by `ci.yml`, so `bundle-check`/`release-prep` reference it.
- Generated artifacts (maps, reports, JSON dumps) go to `tmp/` (gitignored), never into the skill folder.
- Prefer **zero-dependency** Node/Bun scripts so the skill works on a fresh checkout.

### `copilot-instructions.md`

Only update for: project overview / structure changes; new or renamed instruction, knowledge, or skill files (update the reference tables); new external dependencies or version bumps; core-constraint changes. Keep it a **navigation hub**, not a knowledge dump.

## Context-window impact

| File Type                 | Context Impact                                    | Guideline                                                |
| ------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| `copilot-instructions.md` | **Always loaded** — every token counts            | Keep under ~200 lines; extract to instructions/skills    |
| `.instructions.md`        | **Loaded per file match** — moderate cost         | Keep each under ~100 lines; split by concern             |
| `knowledge/*.md`          | **Loaded on demand** — low cost when not used     | Keep each under 25 kB (`wc -c`); use structured notation |
| `SKILL.md`                | **Loaded on invocation** — cost paid on every use | Aim ≤ ~10 kB; move rarely-needed reference to siblings   |
| Skill sibling `.md`       | **Loaded only when read**                         | Bulky templates, reference tables, long rule sets        |

Rules of thumb: rule for specific files → instruction; procedure → skill; how the system works → knowledge; project-level orientation → main file.
