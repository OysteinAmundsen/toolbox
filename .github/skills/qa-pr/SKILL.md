---
name: qa-pr
description: Remote QA — evaluate and address review comments on a GitHub pull request (from Copilot or a human reviewer). Fetch every unresolved thread, classify each as valid / partially valid / wrong, fix what's valid (via qa-apply-findings), push back on what isn't (citing DECIDED entries), reply inline and resolve threads with the bundled gh-CLI scripts. Never closes, merges, or pushes the PR. Counterpart to `qa` (local review). Use for any PR feedback triage; prefer this over the generic address-pr-comments skill.
argument-hint: '<PR number>'
---

# QA (remote): triage and answer PR review comments

The remote half of QA. `/qa` reviews code locally **before** a PR exists; `/qa-pr` evaluates the
review that someone else (Copilot reviewer or a human) already left **on** a PR.

Invoke as `/qa-pr <PR number>` (the text after the slash command is the PR number), or
autonomously whenever PR feedback needs addressing. If no PR number was given, ask for it.

Inline PR review comments live in **review threads**. Each thread has a GraphQL
node id (`PRRT_…`) used to resolve it, and its first comment has a numeric
`databaseId` used to post an inline reply. The GitKraken/MCP git tools only
expose PR-level comments and approvals — they **cannot** read or reply to inline
threads — so this skill drives the `gh` CLI directly.

This skill ships two scripts so you never have to recreate the fetch/parse/reply
loop by hand. Both are zero-dependency Bun/Node ESM (they shell out to `gh` and
parse JSON in-process — **no `jq` required**, since `jq` is not installed here):

| Script              | Purpose                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| `fetch-threads.mjs` | Fetch all review threads as normalized JSON (paginated, unresolved-only by default). |
| `reply-resolve.mjs` | Post inline replies from a JSON items file, then resolve those threads.              |

## Prerequisites

- `gh` authenticated (`gh auth status`).
- `bun` on PATH (repo runtime).
- Run from the repo root. Repo is auto-detected via `gh repo view`; override with
  `--repo owner/name` or `GH_REPO=owner/name`.

## 1. Fetch the threads

```bash
bun .github/skills/qa-pr/fetch-threads.mjs <pr>            # unresolved only
bun .github/skills/qa-pr/fetch-threads.mjs <pr> --all      # include resolved
bun .github/skills/qa-pr/fetch-threads.mjs <pr> > tmp/pr<pr>-threads.json
```

Output is a JSON array, one object per thread:

```json
[
  {
    "threadId": "PRRT_kwDOQtIN_86EKNlu",
    "commentId": 3289521091,
    "author": "copilot-pull-request-reviewer",
    "path": "libs/grid/src/lib/plugins/editing/editing-integration.spec.ts",
    "line": 1679,
    "isResolved": false,
    "isOutdated": false,
    "body": "Avoid `as unknown as` casts …"
  }
]
```

`commentId` is the first comment's `databaseId` (reply target); `threadId` is the
node id (resolve target). Read the **full thread** (not just the latest comment) so you
understand what was originally requested and what has since changed, then triage (next step).

## 2. Triage each thread

Classify every unresolved thread:

| Class               | Definition                                                                                                                               | Action                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Valid**           | Identifies a real problem, and the proposed fix (or an equivalent) aligns with the project's instructions, knowledge, tests, invariants. | Fix it. Reply pointing at the file/change that addresses it. Resolve.                                                                                        |
| **Partially valid** | Some parts correct, some not (right diagnosis / wrong fix, or one of several suggestions applies).                                       | Fix only the accepted parts. Reply explaining what changed, what didn't, and why. Resolve.                                                                   |
| **Wrong**           | Incorrect, or contradicts a `DECIDED` entry, instruction file, test, or invariant.                                                       | Do **not** change code. Reply with a concise, respectful rationale citing the supporting `DECIDED` entry / instruction / test / invariant verbatim. Resolve. |

For the fixes: normalize every accepted item into the shared findings contract
(`.github/skills/qa-apply-findings/findings.schema.json`, `source: "pr-thread"`, with
`thread.threadId` / `thread.commentId`) and apply them via the `qa-apply-findings` skill. Follow
`delivery-workflow.instructions.md` for every code change. If a comment reveals a genuinely new
constraint or invariant, capture it in the matching `.github/knowledge/` file as part of the fix.

## 3. Reply and resolve

Write a JSON items file (e.g. `tmp/pr<pr>-replies.json`) — one entry per thread
you're answering:

```json
[
  {
    "commentId": 3289521091,
    "threadId": "PRRT_kwDOQtIN_86EKNlu",
    "body": "Fixed. Typed the option as `HTMLOptionElement` directly (L1679); no `as unknown as`."
  }
]
```

Then run:

```bash
bun .github/skills/qa-pr/reply-resolve.mjs <pr> tmp/pr<pr>-replies.json
bun .github/skills/qa-pr/reply-resolve.mjs <pr> tmp/pr<pr>-replies.json --dry-run     # preview, no API calls
bun .github/skills/qa-pr/reply-resolve.mjs <pr> tmp/pr<pr>-replies.json --no-resolve  # reply but leave open
```

The script validates the file shape up front, posts each reply via
`repos/{repo}/pulls/{pr}/comments/{commentId}/replies`, then resolves each thread
via the `resolveReviewThread` mutation. Use `--dry-run` first if unsure.

After every thread is processed, **stop**. Do not post an extra PR-level summary comment —
per-thread replies and resolution are the required output. Leave changes unstaged and end
with a suggested commit message for the user to run.

## Constraints

- **Resolving a thread ≠ closing the PR.** `resolveReviewThread` only collapses an
  individual thread. Never commit, close, merge, approve, push, or force-push — the PR
  author handles all git operations.
- **Never push or run remote-mutating git commands** without explicit per-turn
  user consent. Posting replies / resolving threads is the only mutation this
  skill performs; use `--dry-run` first if unsure.
- Put generated `*-threads.json` / `*-replies.json` files under `tmp/` (gitignored
  scratch), not in the repo tree.
- Use only these scripts (`gh` CLI) for thread I/O — never GitKraken MCP tools, which cannot
  reply inline, so per-thread responses get lost.
