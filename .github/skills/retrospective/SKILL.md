---
name: retrospective
description: Post-task "lessons learned" review. Evaluates what worked, what didn't, and proposes updates to instruction and skill files to continuously improve AI-assisted development workflows.
argument-hint: 'optional task summary'
---

# Retrospective — Continuous Improvement of Instructions & Skills

After completing a significant task (feature, bugfix, refactor, investigation), run this retrospective to capture lessons learned and improve the knowledge base for future tasks.

> **When to trigger:** After any task that involved non-trivial problem-solving, debugging, or where the agent had to course-correct. Skip the retrospective only when **all** of these apply: the change touched a single file, was a single logical edit (typo, comment, formatting, or a one-line code change), required no debugging, introduced no new convention, and the agent never needed to course-correct.

## Step 1: Reflect on the Task

Review the conversation and task execution. Answer these questions:

| Question                                      | Look for                                             |
| --------------------------------------------- | ---------------------------------------------------- |
| **What went well?**                           | Patterns, tools, or approaches that were efficient   |
| **What went poorly?**                         | Wasted effort, wrong assumptions, dead ends          |
| **What was surprising?**                      | Unexpected behavior, undocumented quirks, gotchas    |
| **What tools or commands helped?**            | New CLI flags, MCP tools, debugging techniques       |
| **What was missing from instructions?**       | Information that would have saved time if documented |
| **What instructions were wrong or outdated?** | Rules that contradicted actual behavior              |

## Step 2: Classify the Lesson

### Quick routing summary

Use this table first. If the lesson clearly matches one row, skip straight to the listed substep. Use the detailed substeps (2a–2e) only when the answer is not obvious.

| If the lesson is…                                                          | Route to…                                                | Substep |
| -------------------------------------------------------------------------- | -------------------------------------------------------- | ------- |
| An accidental sharp edge that could be fixed in code                       | A new GitHub issue (do not just document the workaround) | 2a      |
| Tied to a specific function, type, or block                                | Inline comment or JSDoc at that location                 | 2b      |
| About _how the system works_ (data flow, invariants, design rationale)     | `.github/knowledge/<file>.md` using structured notation  | 2c      |
| A cross-cutting rule for a file glob (TS, CSS, tests, grid src, adapters…) | `.github/instructions/<topic>.instructions.md`           | 2d      |
| A repeatable multi-step procedure                                          | `.github/skills/<name>/SKILL.md`                         | 2d      |
| Project-level orientation (toolchain, structure, top-level constraints)    | `.github/copilot-instructions.md`                        | 2d      |
| Too niche or one-off to recur                                              | Skip — do not document                                   | 2e      |

Then walk through the substeps below **in order** to confirm the routing and pick the exact target file.

### 2a. Should we fix this instead of documenting it?

If a lesson boils down to "this is unnecessarily hard/confusing," consider whether the root cause can be eliminated. Ask:

- Is this complexity essential, or is it an accident of the current design?
- Would a rename, a better default, or a small refactor make the lesson unnecessary?
- Would a future contributor hit the same wall?

If the answer is "we can fix it" → **create a GitHub issue** instead of (or in addition to) documenting the workaround. Tag it with the relevant area (`grid`, `plugins`, `docs`, `dx`). A library should be bulletproof and easy to use — documenting sharp edges is a fallback, not the goal.

### 2b. Does this belong in the code itself?

The most discoverable place for knowledge is **right where someone will be reading or editing**. Prefer inline placement when the lesson is tied to a specific function, type, or code block:

| Medium             | When to use                                                                                    | Example                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Inline comment** | Implementation gotcha tied to a specific line or block; only relevant when reading _this_ code | `// Do NOT remove — getRow() callers need the map before scheduler` |
| **JSDoc**          | Public API contract, non-obvious parameter semantics, or behavior consumers must know about    | `@remarks With a single rowGroupField, isGroup is always false`     |
| **Type-level doc** | Property or type whose name alone is misleading or ambiguous                                   | JSDoc on `PivotRow.isGroup` explaining what "group" really means    |

**Rule of thumb by file type:**

| File type                 | Belongs here when…                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| **Inline comment** (`//`) | Lesson is only relevant to a maintainer reading _this_ line or block.                        |
| **JSDoc** (`/** ... */`)  | Lesson affects _consumers_ of a public API — must appear in IDE tooltips and generated docs. |
| **Knowledge file**        | Lesson describes how the system works (mental model), not a single line.                     |
| **Instruction file**      | Lesson is a cross-cutting rule auto-applied to a file glob.                                  |
| **Skill file**            | Lesson is a repeatable multi-step procedure.                                                 |

If someone would need to leave the file to understand the code, the comment is missing. If the information is useful to consumers (not just maintainers), make it JSDoc.

### 2c. Does this update the mental model (knowledge files)?

Before routing to instructions or skills, ask: **"Is this about how the system works (descriptive) rather than how to work in the system (prescriptive)?"**

Route to `.github/knowledge/` if the lesson describes:

- How subsystems connect or communicate (data flow, state ownership)
- Why something is designed the way it is (design rationale, trade-offs)
- An invariant that must hold (and would save debugging time if known)
- A known tension or pressure point between subsystems
- An end-to-end operation trace (what happens when X occurs)

| Knowledge file     | Domain                | Route here when lesson is about...                           |
| ------------------ | --------------------- | ------------------------------------------------------------ |
| `grid-core`        | Grid internals        | config-manager, render-scheduler, virtualization, DOM, state |
| `grid-plugins`     | Plugin system         | plugin lifecycle, hooks, inter-plugin communication          |
| `grid-features`    | Feature registry      | feature registration, factory patterns, feature config       |
| `adapters`         | Framework adapters    | React/Vue/Angular bridging, portals, event handling          |
| `build-and-deploy` | Build, CSS, release   | Vite config, bundle budgets, CSS layers, CI pipeline         |
| `data-flow-traces` | End-to-end operations | How a user action flows through the system                   |

**Use the structured notation** when adding to knowledge files:

- `OWNS:` — state or responsibility the subsystem holds
- `READS FROM:` / `WRITES TO:` — data flow edges
- `INVARIANT:` — things that must always be true
- `FLOW:` — operation sequences (use indented pseudocode)
- `TENSION:` — trade-offs and pressure points
- `DECIDED:` — design choices with rationale

### 2d. Route to the right instruction or skill file

For lessons that are cross-cutting (span multiple files, not tied to one code location) or procedural:

| Lesson Type                 | Target File                                                                  | Example                                          |
| --------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| **Project-wide convention** | `.github/copilot-instructions.md`                                            | New toolchain version, changed project structure |
| **File-type convention**    | `.github/instructions/<topic>.instructions.md`                               | New TS pattern to prefer, CSS convention         |
| **Grid-specific pattern**   | `.github/instructions/grid-*.instructions.md`                                | New pitfall, architecture insight                |
| **Repeatable workflow**     | `.github/skills/<name>/SKILL.md`                                             | Multi-step procedure worth codifying             |
| **Tool/command discovery**  | Existing instruction or skill that uses the tool                             | Better CLI flag, new MCP tool usage              |
| **Pitfall / gotcha**        | `.github/instructions/grid-pitfalls.instructions.md` or relevant instruction | Things that waste time if not known              |

**Before choosing a target**, scan the full list of instruction files in `.github/instructions/`, knowledge files in `.github/knowledge/`, and skill files in `.github/skills/`. The right home is whichever file a future agent would have loaded when it needed the lesson. Grid-pitfalls is appropriate only for gotchas specific to the grid's DOM/render behavior — most lessons belong elsewhere.

### 2e. New file or update existing?

- **Update existing** if the lesson fits an existing instruction, knowledge, or skill topic
- **Create new instruction file** if there's no home for it AND it applies to a specific file glob pattern
- **Create new knowledge file** if it describes a new subsystem or domain not yet covered
- **Create new skill** only if it's a multi-step workflow that will be repeated
- **Skip** if the lesson is too niche or one-off to be useful again

## Step 3: Draft the Update

### For instruction files (`.instructions.md`)

Instruction files are **always loaded** when working on matching files. Keep them:

- **Concise** — bullet points, not paragraphs
- **Actionable** — "Do X" not "X is a thing"
- **Correct** — verify the advice actually works before writing it down

Format:

```markdown
---
applyTo: '<glob-pattern>'
---

# Title

- **Rule name**: Brief actionable rule
- **Rule name**: Brief actionable rule
```

### For skill files (`SKILL.md`)

Skills are **loaded on demand** and can be longer. They should contain:

- Step-by-step workflows
- Code templates and scaffolding
- Reference tables
- Verification criteria

Format:

```markdown
---
name: skill-name
description: One-line description for matching against user requests.
argument-hint: <required-arg> [optional-arg]
---

# Title

## Step 1: ...

## Step 2: ...
```

### For the main copilot-instructions.md

Only update this file for:

- Changes to the project overview or monorepo structure
- New instruction files, knowledge files, or skills being added (update the reference tables)
- New external dependencies or version bumps
- Changes to core constraints (bundle budget, etc.)

Keep it as a **navigation hub**, not a knowledge dump.

## Step 4: Evaluate Context Window Impact

Before adding content, consider the cost:

| File Type                 | Context Impact                                | Guideline                                             |
| ------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| `copilot-instructions.md` | **Always loaded** — every token counts        | Keep under ~200 lines; extract to instructions/skills |
| `.instructions.md`        | **Loaded per file match** — moderate cost     | Keep each under ~100 lines; split by concern          |
| `knowledge/*.md`          | **Loaded on demand** — low cost when not used | Keep each under ~120 lines; use structured notation   |
| `SKILL.md`                | **Loaded on demand** — low cost when not used | Can be longer (200-500 lines); include templates      |

**Rules of thumb:**

- If a rule applies to specific files → instruction file (auto-applied)
- If it's a procedure → skill file (loaded on demand)
- If it describes how the system works → knowledge file (loaded at task start)
- If it's project-level orientation → main file (always loaded)
- When in doubt, prefer instruction file over main file

## Step 5: Apply and Verify

1. **Make the edit** to the appropriate file(s)
2. **Update reference tables** in `copilot-instructions.md` if you added/renamed files
3. **Verify consistency** — does the new content contradict anything existing?
4. **Remove outdated content** — if the lesson replaces old advice, delete the old advice
5. **No duplication** — each piece of information lives in exactly one place. If it's in a knowledge file, do not also add it to pitfalls/instructions. If moving information from one file to another, delete it from the source.

## Step 6: Summarize for the User

Present the retrospective findings as a brief report:

```
### Retrospective: [Task Name]

**Lessons captured:**
- ✅ Updated `<file>`: <what changed>
- ✅ Created `<file>`: <why>
- ⏭️ Skipped: <lesson that wasn't worth documenting and why>

**No updates needed** (if nothing was worth capturing)
```

---

## Anti-Patterns

- **Don't document what you can fix** — If the gotcha exists because of accidental complexity, file an issue to fix it. A workaround comment is a last resort, not a first instinct
- **Don't hide code-specific knowledge in instruction files** — If a lesson is tied to a specific function or type, put it in a comment or JSDoc _at that location_. Instruction files are for cross-cutting concerns
- **Don't default to grid-pitfalls** — Pitfalls is just _one_ target. Most lessons belong in architecture, API, testing, CSS, TypeScript conventions, or workflow instructions. Ask "where would a future agent need this?" and route accordingly
- **Don't document one-off quirks** that will never recur
- **Don't bloat the main file** — always ask "can this live in an instruction or skill instead?"
- **Don't duplicate** — if the advice exists elsewhere, add a cross-reference, not a copy
- **Don't speculate** — only document things that were actually verified during the task
- **Don't create a skill for a single-step action** — that's just an instruction bullet point
