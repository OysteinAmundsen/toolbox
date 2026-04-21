# Bootstrap: Knowledge-Base Learning Model

> **For the AI assistant reading this file:** Execute the steps below to set up
> a self-maintaining knowledge base for this repository. The goal is to
> externalize your mental model into dense, structured markdown so future
> sessions don't re-discover the codebase from scratch.
>
> **For the human:** Drop this file at the repo root and tell the assistant
> _"Read `bootstrap-knowledge-base.md` and execute it."_ You can delete it
> after setup, or keep it for reference.

---

## Tier model

The knowledge system has **four tiers**, in priority order:

| Tier | Location                  | Loading       | Purpose                                                                |
| ---- | ------------------------- | ------------- | ---------------------------------------------------------------------- |
| 1    | `copilot-instructions.md` | Always loaded | Project overview, navigation hub, hard constraints, links to tiers 2–4 |
| 2    | `instructions/*.md`       | Auto by glob  | Conventions/rules per file type — **prescriptive** (how to work)       |
| 3    | `knowledge/*.md`          | On demand     | Living mental model — **descriptive** (how it works & why)             |
| 4    | `skills/<name>/SKILL.md`  | On demand     | Multi-step workflows — **procedural** (how to do X)                    |

> Adapt the folder location to the AI tool in use:
>
> - **GitHub Copilot:** `.github/copilot-instructions.md`, `.github/instructions/`, `.github/knowledge/`, `.github/skills/`
> - **Cursor:** `.cursor/rules/*.mdc` for tiers 1–2; tiers 3–4 can live anywhere referenced from the rules
> - **Claude Code:** `CLAUDE.md` for tier 1; sibling folders for the rest

The structure (4 tiers, schema, gates) is what matters — only the loading mechanism changes per tool.

---

## Step 1 — Create the folder structure

```
.github/                                  (or tool-appropriate location)
  copilot-instructions.md                 # tier 1: always-loaded hub
  instructions/                           # tier 2: auto-applied conventions
  knowledge/                              # tier 3: mental model
  skills/                                 # tier 4: workflows
    retrospective/SKILL.md                # required: closes the write-gate loop
```

---

## Step 2 — Knowledge-file schema (mandatory)

Every file under `knowledge/` follows this exact schema. **Do not deviate** — the density and tag vocabulary are what make it scannable.

### Frontmatter

```yaml
---
domain: <short-kebab-name>
related: [other-domain, another-domain]
---
```

### Body

One `## name` heading per module/subsystem. Under each heading, single-line bullets prefixed with one of these tags:

| Tag           | Meaning                                                              |
| ------------- | -------------------------------------------------------------------- |
| `OWNS:`       | State, data, or responsibility this module is the sole authority for |
| `READS FROM:` | External inputs it consumes                                          |
| `WRITES TO:`  | External state it mutates                                            |
| `INVARIANT:`  | A fact that must always hold true                                    |
| `FLOW:`       | End-to-end trace of an operation. Use `FLOW[name]:` for variants     |
| `TENSION:`    | Known trade-off, friction, coupling, or non-obvious cost             |
| `DECIDED:`    | A past design decision with rationale — **do not silently reverse**  |

### Reference example

```markdown
---
domain: render-pipeline
related: [config, state-store]
---

# Render Pipeline — Mental Model

## scheduler

- OWNS: single RAF orchestration, phase system, ready promise
- OWNS: phase hierarchy (higher includes lower): STYLE(1) → ROWS(4) → FULL(6)
- READS FROM: phase requests from ResizeObserver, adapters, property setters
- WRITES TO: executes pipeline in strict phase order
- INVARIANT: only one RAF pending at a time
- INVARIANT: higher phase requests merge to highest (never downgrade)
- FLOW: caller → requestPhase(phase) → if phase > pending: update pending →
  if no RAF: schedule → on RAF: execute phases descending → resolve ready
- TENSION: batching adds complexity vs immediate rendering, but eliminates
  race conditions between observers, framework updates, scroll events
- DECIDED: single-RAF batching chosen over microtask or sync rendering to
  prevent layout thrashing
```

**Rules:**

- One line per entry. No prose paragraphs.
- Optimize for fast scanning and mental-model reconstruction, not prose readability.
- Cross-reference between files via `related:` frontmatter.
- A module that owns nothing yet should still get a heading with at least `OWNS:` so future contributors know it exists.

---

## Step 3 — The read/write gates (this is the whole game)

Add this section **verbatim** to `copilot-instructions.md`. Replace `<DOMAIN_PATHS>` with the project's primary source paths (e.g. `src/**`, `libs/**`).

```markdown
> **Knowledge files — read before editing, write after learning:**
>
> - **Read gate:** Before editing any file in <DOMAIN_PATHS>, or making a
>   non-trivial change anywhere, you MUST first read the knowledge files
>   that cover the affected domain. This rebuilds the mental model — state
>   ownership, invariants, design rationale — so you can spot when a
>   proposed change contradicts an earlier `DECIDED` entry and push back
>   rather than silently regress it. Trivial edits (typos, comments,
>   formatting) are exempt.
> - **Write gate:** During or after any task, if you discover a new
>   invariant, state-ownership fact, data-flow edge, design decision, or
>   tension that is not already in a knowledge file, you MUST add it to the
>   correct file using the structured notation (OWNS / READS FROM /
>   WRITES TO / INVARIANT / FLOW / TENSION / DECIDED). These files are your
>   externalized mental model — if you don't write it down, the next session
>   will rediscover it from scratch.
> - **Rule of thumb:** If the user argues for a change that contradicts a
>   `DECIDED` entry, cite the entry and ask them to justify overriding it
>   before implementing. Past decisions have context; don't silently reverse
>   them.
```

These three rules are what make the system self-maintaining. Without them, the schema is just notation.

---

## Step 4 — The retrospective skill (closes the write-gate loop)

Create `skills/retrospective/SKILL.md` with this content:

```markdown
---
name: retrospective
description: Post-task lessons-learned review. Updates knowledge, instruction, and skill files to continuously improve future sessions.
---

# Retrospective

After any non-trivial task (feature, bugfix, refactor, debugging session),
run this retrospective.

## Step 1 — Reflect

- What went well? (efficient patterns, tools, approaches)
- What went poorly? (wasted effort, wrong assumptions, dead ends)
- What was surprising? (undocumented quirks, gotchas)
- What was missing from instructions/knowledge? (would have saved time)
- What instructions were wrong or outdated?

## Step 2 — Classify (decision tree, in order)

### 2a. Should we fix this instead of documenting it?

If the lesson is "this is unnecessarily hard," consider whether the root
cause can be eliminated (rename, better default, small refactor). File an
issue instead of (or in addition to) documenting the workaround.

### 2b. Does this belong in the code itself?

- Inline comment: implementation gotcha tied to a specific line
- JSDoc: public API contract, non-obvious parameter semantics
- Type-level doc: property whose name alone is misleading

If someone would need to leave the file to understand the code, the comment
is missing.

### 2c. Does this update the mental model? → `knowledge/`

Route here when the lesson describes:

- How subsystems connect or communicate
- Why something is designed the way it is
- An invariant that must hold
- A known tension or pressure point
- An end-to-end operation trace

Use the structured notation (OWNS / READS FROM / WRITES TO / INVARIANT /
FLOW / TENSION / DECIDED).

### 2d. Is it a rule for working in a file type? → `instructions/`

Conventions, naming rules, lint patterns, framework idioms. Add `applyTo`
glob frontmatter so it auto-loads for matching files.

### 2e. Is it a multi-step workflow? → `skills/<name>/SKILL.md`

A repeatable procedure with multiple steps (release prep, debugging flow,
new-component scaffolding).

## Step 3 — Apply

Make the documentation update in the same commit (or a follow-up) and
reference it in the commit message.
```

---

## Step 5 — Initial population

After scaffolding, do an initial pass over the codebase:

1. **Survey the repo.** Identify the major domains/subsystems (e.g. `core`, `plugins`, `adapters`, `build`, `data-flow`). Aim for 4–8 top-level domains.
2. **Propose the file list** — list the knowledge files you intend to create with one-sentence purposes. **Stop and ask the human to confirm before populating.**
3. **For each approved file:**
   - Identify 3–8 core modules in that domain.
   - Fill `OWNS` / `READS FROM` / `WRITES TO` from the actual code.
   - Add `INVARIANT`s you can verify (assertions, types, validation, comments).
   - Add `FLOW` entries tracing the most important end-to-end operations.
   - Add `TENSION`s where you see workarounds, `HACK`/`TODO` comments, non-obvious ordering, or coupling.
   - Add `DECIDED` entries **only** when you find clear rationale (commit messages, ADRs, code comments explaining "why not X"). Do not invent decisions.
4. **Cross-link** via `related:` frontmatter.

Then update `copilot-instructions.md` to include a "Knowledge Reference" table listing each file and its domain, so future sessions know what's available without scanning the folder.

---

## Step 6 — Hand-off

Once setup is complete, report back:

- The list of knowledge files created with their domains.
- The total entry count per file (rough density check — aim for 15–40 entries per file; sparser means you missed things, denser means you're including noise).
- Any domains you flagged but couldn't populate confidently (so the human can fill them in).

From this point on, the read/write gates take over and the knowledge base maintains itself across sessions.
