---
name: pr-comments
description: Read, reply to, and resolve review-comment threads on a GitHub pull request using the gh CLI. Use whenever you need to triage PR feedback (fetch all unresolved review threads as structured JSON, post inline replies on specific threads, and mark threads resolved) instead of hand-writing a one-off gh/GraphQL script each time. Prefer this over the generic address-pr-comments skill for bulk thread triage and programmatic gh/GraphQL access.
---

# Reading and answering PR review comments

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
bun .github/skills/pr-comments/fetch-threads.mjs <pr>            # unresolved only
bun .github/skills/pr-comments/fetch-threads.mjs <pr> --all      # include resolved
bun .github/skills/pr-comments/fetch-threads.mjs <pr> > tmp/pr<pr>-threads.json
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
node id (resolve target). Read the `body` to classify each comment, then build a
replies file (next step).

## 2. Reply and resolve

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
bun .github/skills/pr-comments/reply-resolve.mjs <pr> tmp/pr<pr>-replies.json
bun .github/skills/pr-comments/reply-resolve.mjs <pr> tmp/pr<pr>-replies.json --dry-run     # preview, no API calls
bun .github/skills/pr-comments/reply-resolve.mjs <pr> tmp/pr<pr>-replies.json --no-resolve  # reply but leave open
```

The script validates the file shape up front, posts each reply via
`repos/{repo}/pulls/{pr}/comments/{commentId}/replies`, then resolves each thread
via the `resolveReviewThread` mutation. Use `--dry-run` first if unsure.

## 3. Final PR-level summary comment

For `/pr-qa`, do not post an extra PR-level summary comment. The required output
is per-thread: reply inline and resolve each thread.

## Constraints

- **Resolving a thread ≠ closing the PR.** `resolveReviewThread` only collapses an
  individual thread. Never close, merge, approve, push, or force-push — the PR
  author handles all git operations.
- **Never push or run remote-mutating git commands** without explicit per-turn
  user consent. Posting replies / resolving threads is the only mutation this
  skill performs; use `--dry-run` first if unsure.
- Put generated `*-threads.json` / `*-replies.json` files under `tmp/` (gitignored
  scratch), not in the repo tree.
- This skill only handles GitHub I/O. For the triage policy (classify
  valid / partially-valid / wrong, cite `DECIDED` entries, follow the delivery
  workflow for code changes), see `.github/prompts/pr-qa.prompt.md`.
