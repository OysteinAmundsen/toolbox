---
description: 'Token-budget mode system. `setup` installs a portable AI-usage-mode flag into this project (one-time), `saving` persists the bare-minimum/credit-saving mode, and `full` restores full autonomy. Designed to be copied into any project to govern how aggressively the agent spends tokens/credits.'
argument-hint: '[setup | saving | full]'
agent: 'agent'
---

# AI Usage Mode (token budget)

A portable, project-scoped flag (`full` | `saving`) that governs how aggressively the agent
spends tokens/credits. This single prompt owns three subcommands:

| Subcommand        | Effect                                                                                |
| ----------------- | ------------------------------------------------------------------------------------- |
| `/ai_mode setup`  | One-time install of the mode system into this project's instruction files.            |
| `/ai_mode saving` | Persist the **saving** flag for this project (bare minimum; hand heavy work back).    |
| `/ai_mode full`   | Restore **full** mode for this project (full autonomy; the default when no flag set). |

The active flag lives in a project-scoped instruction file so it is portable: copying this
prompt + the generated instruction file into another repo carries the whole system with it.

---

## Parse the argument

`${input:target}` is one of `setup`, `saving`, or `full`. If it is exactly one of those, jump to
the matching section below. Otherwise (empty or unrecognized) → **do not change anything** and
follow the `## Default / no-argument behavior` section.

---

## Default / no-argument behavior

Run these steps in order; do not modify any file.

1. Read `.github/instructions/ai-mode.instructions.md`.
2. If the file does not exist, respond exactly: "The AI mode system is not installed. Run
   `/ai_mode setup` to install it." Then stop.
3. If the file exists but contains neither `**Current mode: full**` nor `**Current mode: saving**`,
   respond that the file appears corrupted, show its current contents, and ask whether to re-run
   `/ai_mode setup` to restore it. Then stop.
4. If the file exists and contains a valid flag line, extract its value and respond:
   "Current mode: [value]. Available subcommands: `/ai_mode saving`, `/ai_mode full` (and
   `/ai_mode setup` to reinstall)." Then stop.

---

## `setup` — install the mode system (one-time)

Goal: make the flag auto-load every session in **this** project, with zero dependency on
machine-global user memory, so the system is portable.

1. **Check for an existing install.** If `.github/instructions/ai-mode.instructions.md` already
   exists, report that the system is already installed, show its `Current mode:` line, and stop
   (do not overwrite). Offer `/ai_mode saving` / `/ai_mode full` to toggle instead.

2. **Create the always-on instruction file.** If the directory `.github/instructions/` does not
   exist, create it first (report the directory creation in the final summary). Then create
   `.github/instructions/ai-mode.instructions.md` with `applyTo: '**'` so it loads in every
   session, using exactly this content (default mode is `full`):

   ```markdown
   ---
   applyTo: '**'
   description: 'AI usage mode (token budget). Auto-loaded every session; the Current mode line below is the active flag.'
   ---

   # AI Usage Mode — active flag

   <!-- Toggle with the /ai_mode prompt. Keeping this change uncommitted makes the flag
        machine-local; committing it shares the mode with the whole team. -->

   **Current mode: full**

   Valid values: `full` | `saving`.

   ## When mode is `saving`

   Do the **bare minimum** for the literal request and hand credit-heavy work back to the user.
   This overrides the _execution_ of credit-heavy workflow steps; it never relaxes safety/consent
   rules.

   - Do **not** run tests, lint, builds, or debugging unless explicitly asked. Instead, hand off
     the exact command for the user to run and mark those steps "deferred to user (saving mode)".
     Handoff examples (replace with this project's real commands — the `setup` discovery step
     below fills these in):
     - Tests / build / lint: `<project test+build+lint command>`
     - Single-target re-run: `<project test command>`
   - Stop after the implementation edit; do not proactively verify, profile, or expand scope.
   - Minimize tool calls, file inspection, and analysis to only what the requested edit strictly
     requires.
   - For subagents, pass the cheapest capable model and keep delegation minimal.
   - Pause and ask before any operation that would read more than 5 files at once, execute a
     build or test suite, perform a web fetch, or delegate to a subagent expected to run for more
     than one tool-call round-trip.

   ## When mode is `full`

   Behave with full autonomy: full tool use, debugging, and test/build/lint cycles, exactly as
   the project's normal workflow prescribes.

   ## Safety

   This flag only governs token-spend autonomy. It never overrides safety rules (e.g. never push
   or merge to a remote without explicit per-request consent).
   ```

3. **Discover project-specific saving-mode deferrals.** The goal is to make explicit, in the
   instruction file, exactly which workflow steps to tighten when `saving` — so nothing is left to
   guesswork. Do this:
   1. Find this project's delivery/workflow instruction files. Look under `.github/instructions/`
      for files whose name or content covers the delivery checklist, build, test, lint, e2e,
      profiling, or debugging (e.g. `delivery-workflow.instructions.md`). Also check
      `.github/copilot-instructions.md` and `AGENTS.md` for the canonical build/test/lint command.
   2. From those files, extract every **credit-heavy step** that an agent would otherwise run
      autonomously (test, build, lint, e2e, profiling, benchmarking, debugging) and the **exact
      command** the project uses to run them.
   3. Append a `### Project-specific deferrals (discovered at setup)` section to the end of
      `.github/instructions/ai-mode.instructions.md` listing each discovered step as a bullet:
      what to defer and the exact handoff command. Also replace the `<project … command>`
      placeholders in the `## When mode is \`saving\`` section with the real commands found.
   4. If no such workflow files or commands are found, append the section anyway with a single
      line: "No project-specific delivery steps discovered; apply the generic saving-mode rules
      above." Report this in the final summary so the user can add deferrals manually.

4. **Add a pointer (optional, only if a hub file exists).** If `.github/copilot-instructions.md`
   exists and does not already contain the exact string `ai_mode` (case-sensitive substring
   search), append the following exact block to the end of the file verbatim (the heading is part
   of the block):

   ```markdown
   ## AI Usage Mode

   The active token-budget flag lives in `.github/instructions/ai-mode.instructions.md`. Toggle it
   with `/ai_mode saving` or `/ai_mode full`.
   ```

   Otherwise skip this step. If the append fails for any reason (e.g. the file is read-only), skip
   it, note the failure in the final report, and instruct the user to add the pointer manually.

5. **Report** what was created and confirm the default mode is `full`. Tell the user they can keep
   the flag change uncommitted for machine-local persistence, or commit it to share with the team.

---

## `saving` — persist the saving flag

1. Ensure `.github/instructions/ai-mode.instructions.md` exists. If not, tell the user to run
   `/ai_mode setup` first and stop.
2. Find the line matching `**Current mode: full**` or `**Current mode: saving**` and replace it in
   its entirety with `**Current mode: saving**`. If no such line is found, insert
   `**Current mode: saving**` immediately after the `# AI Usage Mode — active flag` heading and
   report that the line was missing and has been added.
3. Confirm: "Saving mode active for this project. I'll do the bare minimum and hand credit-heavy
   work back to you." Remind them the change is in the working tree (uncommitted = machine-local).

---

## `full` — restore full mode

1. Ensure `.github/instructions/ai-mode.instructions.md` exists. If not, tell the user to run
   `/ai_mode setup` first and stop.
2. Find the line matching `**Current mode: full**` or `**Current mode: saving**` and replace it in
   its entirety with `**Current mode: full**`. If no such line is found, insert
   `**Current mode: full**` immediately after the `# AI Usage Mode — active flag` heading and
   report that the line was missing and has been added.
3. Confirm: "Full mode active. Normal autonomy and full test/build/lint cycles restored."

---

## Notes

- The flag is read from the `Current mode:` line of the instruction file every session because
  that file uses `applyTo: '**'` and is auto-loaded.
- Persistence is project-scoped by design: each repo carries its own flag. Toggling here never
  affects other projects.
- Portability: to install on another project, copy this prompt file into its `.github/prompts/`
  and run `/ai_mode setup` there.
