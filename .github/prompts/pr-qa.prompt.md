---
description: Triage and address review comments on a pull request — fix what's valid, push back on what isn't, then resolve threads.
mode: agent
---

We have new comments on PR #${input:prNumber:PR number (e.g. 285)}.

For each unresolved review comment / thread:

1. **Read the full thread** (not just the latest comment) so you understand what was originally requested and what has since changed. Use the `address-pr-comments` skill if available; otherwise fetch via the GitHub PR tools.
2. **Decide**: is the comment valid, partially valid, or wrong?
   - **Valid** → implement the fix following the standard delivery workflow (knowledge read → code → test → build/lint → docs → retrospective). Reply on the thread with a short note pointing at the file/change that addresses it, then resolve the thread.
   - **Partially valid** → implement the parts you agree with, reply explaining what you did and did not change and why, then resolve.
   - **Wrong / disagree** → do NOT change the code. Reply with a concise, respectful rationale citing the relevant `DECIDED` knowledge entry, instruction file, test, or invariant that supports keeping the current behavior. Resolve the thread once you've replied.
3. **Do NOT commit, push, force-push, merge, or close the PR.** Leave changes unstaged in the working tree. End with a suggested commit message for the user to run themselves. The author handles all git operations.
4. After processing every thread, post a short summary comment on the PR listing: addressed (with file refs), partially addressed, and disagreed-with (with one-line reasons).

Constraints:

- Follow `.github/instructions/delivery-workflow.instructions.md` for any code change — including the 7-step checklist and commit-message conventions.
- If a comment contradicts an existing `DECIDED` entry in `.github/knowledge/`, cite the entry verbatim in your reply rather than silently regressing the decision.
- If a comment reveals a genuinely new constraint or invariant, capture it in the appropriate knowledge file as part of the fix.
