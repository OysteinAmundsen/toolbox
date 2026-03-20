---
name: retrospective
description: Post-task "lessons learned" review. Evaluates what worked, what didn't, and proposes updates to instruction and skill files to continuously improve AI-assisted development workflows.
argument-hint: [task-summary]
---

# Retrospective — Continuous Improvement of Instructions & Skills

After completing a significant task (feature, bugfix, refactor, investigation), run this retrospective to capture lessons learned and improve the knowledge base for future tasks.

> **When to trigger:** After any task that involved non-trivial problem-solving, debugging, or where the agent had to course-correct. Not needed for trivial one-line fixes.

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

Determine where the lesson belongs:

| Lesson Type                 | Target File                                                                  | Example                                          |
| --------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| **Project-wide convention** | `.github/copilot-instructions.md`                                            | New toolchain version, changed project structure |
| **File-type convention**    | `.github/instructions/<topic>.instructions.md`                               | New TS pattern to prefer, CSS convention         |
| **Grid-specific pattern**   | `.github/instructions/grid-*.instructions.md`                                | New pitfall, architecture insight                |
| **Repeatable workflow**     | `.github/skills/<name>/SKILL.md`                                             | Multi-step procedure worth codifying             |
| **Tool/command discovery**  | Existing instruction or skill that uses the tool                             | Better CLI flag, new MCP tool usage              |
| **Pitfall / gotcha**        | `.github/instructions/grid-pitfalls.instructions.md` or relevant instruction | Things that waste time if not known              |

### Decision: New file or update existing?

- **Update existing** if the lesson fits an existing instruction or skill topic
- **Create new instruction file** if there's no home for it AND it applies to a specific file glob pattern
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
- New instruction files or skills being added (update the reference tables)
- New external dependencies or version bumps
- Changes to core constraints (bundle budget, etc.)

Keep it as a **navigation hub**, not a knowledge dump.

## Step 4: Evaluate Context Window Impact

Before adding content, consider the cost:

| File Type                 | Context Impact                                | Guideline                                             |
| ------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| `copilot-instructions.md` | **Always loaded** — every token counts        | Keep under ~200 lines; extract to instructions/skills |
| `.instructions.md`        | **Loaded per file match** — moderate cost     | Keep each under ~100 lines; split by concern          |
| `SKILL.md`                | **Loaded on demand** — low cost when not used | Can be longer (200-500 lines); include templates      |

**Rules of thumb:**

- If a rule applies to specific files → instruction file (auto-applied)
- If it's a procedure → skill file (loaded on demand)
- If it's project-level orientation → main file (always loaded)
- When in doubt, prefer instruction file over main file

## Step 5: Apply and Verify

1. **Make the edit** to the appropriate file(s)
2. **Update reference tables** in `copilot-instructions.md` if you added/renamed files
3. **Verify consistency** — does the new content contradict anything existing?
4. **Remove outdated content** — if the lesson replaces old advice, delete the old advice

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

- **Don't document one-off quirks** that will never recur
- **Don't bloat the main file** — always ask "can this live in an instruction or skill instead?"
- **Don't duplicate** — if the advice exists elsewhere, add a cross-reference, not a copy
- **Don't speculate** — only document things that were actually verified during the task
- **Don't create a skill for a single-step action** — that's just an instruction bullet point
