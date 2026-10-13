---
name: retrospective
description: Post-task "lessons learned" review. Evaluates what worked, what didn't, and routes each lesson to the right home (code comment, knowledge file, instruction, or skill). Also owns the knowledge-file style rules (condense pass, splitting) — read it before writing to any .github/knowledge/*.md file.
argument-hint: 'optional task summary'
---

# Retrospective — Continuous Improvement of Instructions & Skills

After completing a significant task (feature, bugfix, refactor, investigation), run this retrospective to capture lessons learned and improve the knowledge base for future tasks.

> **When to trigger:** After any task that involved non-trivial problem-solving, debugging, or where the agent had to course-correct. Skip only when **all** of these apply: single file, single logical edit (typo, comment, formatting, one-line change), no debugging, no new convention, no course-correction.

Sibling files (read only when the step says so):

| File                 | Read when                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `knowledge-style.md` | You wrote to **any** `.github/knowledge/*.md` file (mandatory condense pass; split rules)         |
| `authoring.md`       | Routing is not obvious, or you are creating/extending an instruction or skill (templates, budget) |

## Step 1: Reflect on the Task

| Question                                      | Look for                                             |
| --------------------------------------------- | ---------------------------------------------------- |
| **What went well?**                           | Patterns, tools, or approaches that were efficient   |
| **What went poorly?**                         | Wasted effort, wrong assumptions, dead ends          |
| **What was surprising?**                      | Unexpected behavior, undocumented quirks, gotchas    |
| **What tools or commands helped?**            | New CLI flags, MCP tools, debugging techniques       |
| **What was missing from instructions?**       | Information that would have saved time if documented |
| **What instructions were wrong or outdated?** | Rules that contradicted actual behavior              |

## Step 2: Classify the Lesson

| If the lesson is…                                                          | Route to…                                                | Substep |
| -------------------------------------------------------------------------- | -------------------------------------------------------- | ------- |
| An accidental sharp edge that could be fixed in code                       | A new GitHub issue (do not just document the workaround) | 2a      |
| Tied to a specific function, type, or block                                | Inline comment or JSDoc at that location                 | 2b      |
| About _how the system works_ (data flow, invariants, design rationale)     | `.github/knowledge/<file>.md` using structured notation  | 2c      |
| A cross-cutting rule for a file glob (TS, CSS, tests, grid src, adapters…) | `.github/instructions/<topic>.instructions.md`           | 2d      |
| A repeatable multi-step procedure                                          | `.github/skills/<name>/SKILL.md`                         | 2d      |
| Project-level orientation (toolchain, structure, top-level constraints)    | `.github/copilot-instructions.md`                        | 2d      |
| Too niche or one-off to recur                                              | Skip — do not document                                   | 2e      |

If the routing is not obvious, walk 2a–2e in order (detail tables in `authoring.md`).

- **2a. Fix instead of document?** If the lesson is "this is unnecessarily hard/confusing" and a rename, better default, or small refactor would remove it → **create a GitHub issue** (tag `grid`, `plugins`, `docs`, `dx`). Documenting sharp edges is a fallback, not the goal.
- **2b. Belongs in the code?** Prefer the spot where someone will be reading/editing: inline comment for maintainers of _this_ line; JSDoc for anything consumers must know (it reaches IDE tooltips and generated docs).
- **2c. Mental model?** Descriptive lessons (subsystem connections, design rationale, invariants, tensions, end-to-end traces) go to `.github/knowledge/`. Pick the file from the **Knowledge Reference** table in `copilot-instructions.md`. Use the structured markers: `OWNS:` · `READS FROM:` / `WRITES TO:` · `INVARIANT:` · `FLOW:` · `TENSION:` · `DECIDED:`.
- **2d. Instruction or skill?** **When both fit, write the skill.** Skills cost nothing until invoked and keep their assets together; instructions are a permanent tax on every matching file. Reserve instructions for rules that must **always** apply to a whole class of files; let the instruction carry at most a one-line pointer to the skill.
- **2e. New file or update existing?** Update an existing file whenever the topic fits; create a new instruction only for a new file glob, a new knowledge file only for a new subsystem, a new skill only for a repeatable multi-step workflow (see "Signals" in `authoring.md`). Check whether an existing skill already owns the job before adding a sibling.

## Step 3: Draft and Apply

1. **Draft** using the templates in `authoring.md` (instruction / skill / main-file rules, script placement, context budget).
2. **Make the edit** to the appropriate file(s).
3. **Update reference tables** in `copilot-instructions.md` if you added/renamed files.
4. **Verify consistency** — does the new content contradict anything existing?
5. **Remove outdated content** — if the lesson replaces old advice, delete the old advice.
6. **No duplication** — each fact lives in exactly one place. When moving information, delete it from the source; elsewhere, cross-reference instead of copying.

## Step 4: Knowledge condense pass (MANDATORY if you touched `.github/knowledge/`)

If you wrote to **any** knowledge file — even a one-bullet append — read `knowledge-style.md` and apply its condense pass (and split evaluation if over budget) before finishing. Skipping this is how knowledge files drift into changelog prose.

## Step 5: Summarize for the User

```
### Retrospective: [Task Name]

**Lessons captured:**
- ✅ Updated `<file>`: <what changed>
- ✅ Created `<file>`: <why>
- ⏭️ Skipped: <lesson that wasn't worth documenting and why>

**Knowledge condense pass:** (only if Step 4 ran)
- `<knowledge-file>`: <bytes before> → <bytes after>, <split? yes/no, why>

**No updates needed** (if nothing was worth capturing)
```

---

## Anti-Patterns

- **Don't document what you can fix** — file an issue to remove accidental complexity; a workaround comment is a last resort.
- **Don't hide code-specific knowledge in instruction files** — put it in a comment or JSDoc _at that location_.
- **Don't default to grid-pitfalls** — it is one target among many; ask "where would a future agent need this?"
- **Don't document one-off quirks** that will never recur.
- **Don't bloat the main file** — always ask "can this live in an instruction or skill instead?"
- **Don't duplicate** — cross-reference, don't copy.
- **Don't speculate** — only document things actually verified during the task.
- **Don't create a skill for a single-step action** — that's an instruction bullet.
- **Don't skip the condense pass** — every knowledge-file write triggers it; drift compounds silently.
- **Don't split prematurely** — split only at a real seam (`knowledge-style.md`).
