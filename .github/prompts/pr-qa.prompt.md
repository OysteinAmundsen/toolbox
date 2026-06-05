---
description: Triage and address review comments on a pull request — fix what's valid, push back on what isn't, then mark threads resolved (without closing the PR).
agent: agent
---

We have new comments on PR #${input:prNumber:PR number (e.g. 285)}.

For each unresolved review comment / thread:

1. **Read the full thread** (not just the latest comment) so you understand what was originally requested and what has since changed. Fetch every thread with the `pr-comments` skill (`fetch-threads.mjs`).
2. **Classify the comment** using these explicit definitions, then jump to the matching subsection below:
   - **Valid** → the comment is fully correct: it identifies a real problem and the proposed fix (or an equivalent one) aligns with the project's instructions, knowledge entries, tests, and invariants.
   - **Partially valid** → some parts of the comment are correct and some are not (e.g. the diagnosis is right but the suggested fix is wrong, or one of several suggestions applies).
   - **Wrong** → the comment is incorrect or contradicts a `DECIDED` entry, instruction file, test, or invariant; no code change is warranted.

After classification, normalize all actionable items into the shared findings contract
from `.github/skills/qa-apply-findings/findings.schema.json` (source=`pr-thread`) and
use `qa-apply-findings` as the common execution core for code changes.

### Handling a Valid comment

- Normalize the comment into a finding item and run `qa-apply-findings` to implement + validate.
- Reply on the thread with a short note pointing at the file/change that addresses it.
- Mark the thread resolved.

### Handling a Partially valid comment

- Normalize only the accepted parts as finding items and run `qa-apply-findings`.
- Reply explaining what you changed, what you did not change, and why.
- Mark the thread resolved.

### Handling a Wrong comment

- Do NOT change the code.
- Reply with a concise, respectful rationale citing the relevant `DECIDED` knowledge entry, instruction file, test, or invariant that supports keeping the current behavior.
- Mark the thread resolved once you've replied.

3. **Do NOT commit, push, force-push, merge, or close the PR itself.** "Mark the thread resolved" above refers to the per-thread `resolveReviewThread` GraphQL mutation only — it collapses an individual review thread and does not close the pull request. Leave changes unstaged in the working tree. End with a suggested commit message for the user to run themselves. The author handles all git operations.
4. After processing every thread, stop. Do not post an additional final PR-level summary comment; per-thread replies and thread resolution are sufficient.

Constraints — grouped by category:

**Tools (GitHub interactions):**

- **Use the `pr-comments` skill** for all inline-thread I/O: it ships `fetch-threads.mjs` (fetch every review thread as normalized JSON) and `reply-resolve.mjs` (post inline replies + resolve threads from a JSON items file). It drives the `gh` CLI under the hood. Do NOT use the GitKraken MCP tools — they only support PR-level comments and approvals, not inline thread replies, so per-thread responses get lost.
- Do not post a final PR-level summary comment from this workflow.

**Workflows (code changes):**

- Follow `.github/instructions/delivery-workflow.instructions.md` for any code change — including the 7-step checklist and commit-message conventions.

**Documentation (knowledge base):**

- If a comment contradicts an existing `DECIDED` entry in `.github/knowledge/`, cite the entry verbatim in your reply rather than silently regressing the decision.
- If a comment reveals a genuinely new constraint or invariant, capture it in the appropriate knowledge file as part of the fix.
