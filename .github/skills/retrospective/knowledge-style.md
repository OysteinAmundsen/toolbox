# Knowledge-file style: condense pass & splitting

Read this **before finishing any task that wrote to `.github/knowledge/*.md`** — including a
one-bullet append. Referenced from the `retrospective` skill (Step 5) and `copilot-instructions.md`.

## Condense pass (MANDATORY after any knowledge write)

> Skipping this is what causes knowledge files to drift into changelog prose and lose their value as agent memory. The "I just added one line" case is exactly when drift happens, because nobody re-reads the surrounding context.

For each knowledge file you touched, re-read the whole file end-to-end and apply the style rules below. Knowledge files are an _agent_ tool: their value is being scannable enough to rebuild a mental model in seconds without burning context window, and they lose it the moment they drift into changelog prose.

1. **Re-read the entire file** (not just the section you edited). You cannot spot drift by looking at the diff.
2. **Fold, don't stack.** If your new entry restates or extends an existing `DECIDED` / `INVARIANT` / `TENSION`, rewrite that entry in place. Do not leave both the old and new versions side by side.
3. **`DECIDED` is one bullet, not a paragraph.** Format: `DECIDED (date/PR): <conclusion>. WHY: <one-line rationale>. <File / test reference>.` Aim for 1–4 lines. If you have more to say, the next bullet is `INVARIANT:` or `TENSION:`, not a continuation paragraph.
4. **Strip prose.** Kill adjectives, transitions, "we will…", narrative tone, and explanations of obvious mechanics. Keep proper nouns (file paths, function/class names, PR/issue numbers, MUST/MUST NOT rules) — they are the navigation targets. Write for yourself, not the user: bullets, tables, code fences, structured markers.
5. **Collapse enumerations into tables.** Any list of ≥4 parallel items (plugins, features, hooks, bindings, options) belongs in a markdown table, not stacked bullets. **But watch the byte cost:** Prettier re-pads every cell to the widest one, so a table with one very wide column (e.g. an event list) can cost 2× its content in whitespace. When one column dwarfs the rest, use a bullet list (`- name → a, b, c`) and state any uniform column in a single sentence above it. Re-run `bunx prettier --write` before measuring `wc -c`.
6. **Delete dead history.** "We tried X, then Y, then Z" is git's job. Keep the conclusion; drop the path that got there. Exception: a single "RULED OUT:" line for alternatives that look obvious but don't work. Likewise, when a multi-pass refactor lands, replace the per-pass narrative with the post-refactor invariants.
7. **Move guidance to the right home.** Test-writing patterns belong in `testing-patterns.instructions.md`; workflow recipes belong in `.github/skills/`. Knowledge files describe _how the code is and why_, not _how to work_.
8. **Check the size budget.** Run `wc -c .github/knowledge/<file>.md`. Soft cap: **≤25 kB**. Hard cap: **30 kB**. Line count is NOT the metric — these files use very long bullets, so a 150-line file can still be 60 kB (≈15k tokens).
   - If you're still under 25 kB after condensing → done.
   - If 25–30 kB → condense harder before finishing.
   - If >30 kB or condensing isn't enough → **evaluate a split** (next section).
9. **Sanity-scan headings.** Each `## name` heading should still have at least one of `OWNS:` / `READS FROM:` / `WRITES TO:` / `INVARIANT:` / `FLOW:` / `TENSION:` / `DECIDED:`. If a heading has degenerated into a prose dump with no structured markers, restructure it.
10. **Keep the orientation header.** Every knowledge file opens with a one-line scope statement, a bullet list of "X lives in `<other-file>.md`" redirects for adjacent domains, and a `Read order for <symptom>:` line. This is what makes a split cheap — an agent that opens the wrong file is redirected in one line instead of reading 15 kB to find out.

End-state check: ask yourself, _"If I started a new session tomorrow and loaded only this file, could I rebuild the mental model of this domain in under a minute?"_ If no, condense more.

## Evaluate splitting (when a file outgrows its domain)

A knowledge file should cover **one mental model**. Condensing is exhausted once a filler census finds <5 % removable prose (measured Aug 2026: ~2.5 % in `grid-core.md`, 0.6 % in `grid-render-pipeline.md`) — at that point splitting is the only lever left. Split when any of these are true:

- File is >30 kB after a serious condense pass.
- The file has grown to cover two clearly separable subdomains (e.g. `adapters.md` describing React, Vue, _and_ Angular bridging in detail).
- A future agent loading the file for question X would have to skip past >50% of the file that is irrelevant to X.
- Two top-level sections share almost no `related:` cross-references with each other.

**Split only where the boundary matches how tasks scope.** An arbitrary split is a net loss: if a typical task needs both halves, you pay two lookups plus cross-file duplication drift. Split when one half is genuinely never read for the other's tasks (sorting work never needs virtualization internals). Do NOT split a file dominated by one section — `grid-core.md`'s `grid.ts` section is 51 % of the file, so splitting it did nothing; extracting the self-contained pointer/touch trio into `grid-input.md` did. Do NOT split a file whose sections are all one concern (`adapters.md`).

How to split:

1. **Identify the seam.** Pick the natural boundary (per-framework, per-subsystem, per-lifecycle-phase). Avoid splits that force readers to load both files together for every task.
2. **Create the new file** with the same frontmatter schema. Add `related: [original-file, ...]` to both sides.
3. **Move, don't copy.** Cut the section from the original; paste into the new file. Update any cross-references in other knowledge / instruction / skill files.
4. **Update `copilot-instructions.md` → Knowledge Reference table** with the new file and a one-line domain description.
5. **Re-run the condense pass** on both halves — splits often expose redundancy that was hidden when the content was interleaved.
6. **Prove no facts were lost** by diffing navigation tokens (file paths, `#NNN` issue numbers, symbol names) between before and after — for a split, compare against the **union** of the halves. Include `mdx` in the extension alternation, or `.mdx` paths truncate to `.md` and show as false losses.

If you can't justify a split cleanly, condense harder instead. Splitting prematurely fragments the mental model and forces multi-file loads for single questions.
