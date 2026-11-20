---
name: qa-pr
description: Remote QA — evaluate and address review comments on a GitHub pull request (from Copilot or a human reviewer). Fetch every unresolved thread, classify each as valid / partially valid / wrong, fix what's valid (via qa-apply-findings), push back on what isn't (citing DECIDED entries), reply inline and resolve threads with the bundled gh-CLI scripts. Then amend the PR's head commit, `git push --force-with-lease`, re-request the Copilot reviewer and repeat until a round has nothing left to fix. Decides as the library maintainer (bundle size → correctness → performance; public API stable). Never merges, closes or approves the PR. Counterpart to `qa` (local review). Use for any PR feedback triage; prefer this over the generic address-pr-comments skill.
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

This skill ships three scripts so you never have to recreate the fetch/parse/reply
loop by hand. All are zero-dependency Bun/Node ESM (they shell out to `gh` and
parse JSON in-process — **no `jq` required**, since `jq` is not installed here):

| Script                    | Purpose                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `fetch-threads.mjs`       | Fetch all review threads as normalized JSON (paginated, unresolved-only by default). |
| `reply-resolve.mjs`       | Post inline replies from a JSON items file, then resolve those threads.              |
| `wait-copilot-review.mjs` | (Re-)request a Copilot review and wait for its review of the current head commit.    |

## Decision priorities (every triage and every fix)

Decide as the library's maintainer, not as the reviewer's executor. A review comment is a hypothesis;
the project's rules decide whether and how it is acted on. When a comment, or your fix for it, forces a
trade-off, resolve it in this order:

1. **Bundle size.** Never grow the core bundle (`index.js`) to answer a comment. Find the fix that keeps
   core flat first: put the logic in the owning plugin or adapter, reuse an existing helper, or narrow the
   change. If the only correct fix grows core, do not apply it: reply with the trade-off and, when it is a
   real defect, file a bug issue (standing consent, `delivery-workflow.instructions.md`). Run the
   `bundle-check` skill whenever a fix touches `libs/grid/src/lib/core/**`.
2. **Correctness.** Within that constraint, the fix must be right for every consumer and plugin
   combination, not just the reviewer's example (step 2's adversarial self-review).
3. **Performance.** Among correct fixes, prefer the one that adds no work to hot paths (render, scroll,
   `processRows`/`processColumns`).

Always:

- **Respect the public API** (`libs/grid/src/public.ts`, adapter `index.ts` barrels). No renames, removals
  or signature changes to satisfy a comment. A new public symbol must pass the Step 0 evaluation in
  `delivery-workflow.instructions.md` and get a `@since` tag (`since-tag` skill).
- **When in doubt, read before deciding:** the `.github/knowledge/*.md` files for the touched domain, the
  matching instruction file, and the user-facing docs page under `apps/docs/src/content/docs/grid/`. A
  `DECIDED` entry outranks the reviewer; cite it when pushing back.

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

For the fixes: apply the **Decision priorities** above to both the classification and the chosen fix — a
comment whose fix would grow core or break the public API is at most partially valid. Normalize every accepted item into the shared findings contract
(`.github/skills/qa-apply-findings/findings.schema.json`, `source: "pr-thread"`, with
`thread.threadId` / `thread.commentId`) and apply them via the `qa-apply-findings` skill. Follow
`delivery-workflow.instructions.md` for every code change. If a comment reveals a genuinely new
constraint or invariant, capture it in the matching `.github/knowledge/` file as part of the fix.

**Before replying "Fixed", review your own fix adversarially.** Code written to answer a review comment is where the
next comment lands: on #604 each of three rounds was triggered by the previous round's fix. Run `/qa` →
"Interaction & adversarial review" steps 3–5 on the new code. That means: falsify any classifier or heuristic the
fix adds, check the staleness of any state it caches, and probe with the other plugins in both registration orders
(`.github/skills/qa/scripts/probe.ts`). Prove each new regression test with `qa/scripts/mutation-check.ts`. Fix what
that finds in the same round.

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

Do not post an extra PR-level summary comment — per-thread replies and resolution are the
required output. Then continue with step 4.

## 4. Review loop (always)

Every `/qa-pr` run ends with this loop. Each round: amend → push → request Copilot review → wait →
triage the new threads (steps 1–3). Invoking `/qa-pr` is the user's consent for exactly the remote
writes below, on this PR only (`delivery-workflow.instructions.md` → "Standing consent: `/qa-pr`").

**Preflight (once, before the first amend).** Stop and ask the user if any check fails:

```bash
gh pr view <pr> --json headRefName,headRefOid,state,isCrossRepository
git branch --show-current
git status --porcelain
```

- The PR is `OPEN`, not cross-repository, and the checked-out branch equals `headRefName` (never `main`).
- Local `HEAD` equals `headRefOid`. If not, someone else pushed: stop rather than overwrite their work.
- `git status` lists only files this run changed. Unrelated edits mean the working tree is not yours to amend.

**Each round:**

1. **Gate.** The changes from step 2 must pass the delivery-workflow gates
   (`bun nx affected -t lint test build`) before anything is committed.
2. **Amend.** Stage only the files this round changed (`git add <paths>` — never `git add -A`), then
   `git commit --amend --no-edit`. Only the tip commit is amended; keep its message and trailers.
3. **Push.** Lease against the head SHA recorded before the amend, so a concurrent push is never overwritten
   (a bare `--force-with-lease` trusts the remote-tracking ref, which any `git fetch` silently refreshes):

   ```bash
   git push --force-with-lease=<headRefName>:<headRefOid before amend> origin HEAD:<headRefName>
   ```

4. **Request + wait.**

   ```bash
   bun .github/skills/qa-pr/wait-copilot-review.mjs <pr> --request   # gh pr edit --add-reviewer @copilot, then poll
   bun .github/skills/qa-pr/wait-copilot-review.mjs <pr>             # only wait (review already requested)
   ```

   The review arrives as a normal PR review from `copilot-pull-request-reviewer[bot]` whose `commit_id`
   is the new head SHA (≈5–15 min; the script polls for up to 25). Run it as a long-running command and
   wait for it to exit; do not poll by hand. On `TIMEOUT`, run it once more without `--request`, then
   stop and report. To read a review's verdict by hand, use
   `gh api --paginate repos/<owner>/<repo>/pulls/<pr>/reviews`: the endpoint pages at 30, so after a long
   loop an unpaginated `| last` silently returns an old round's review.

5. **Triage** the new unresolved threads (steps 1–3).
   - **Something was fixed** (any valid or partially valid thread changed code) → next round.
   - **Nothing to fix** (no new threads, or every thread was answered with a pushback or a reply that
     changed no code) → **quit**. Re-requesting a review of an unchanged commit only re-litigates
     pushbacks.

Record a theme the reviewer raises again after a pushback as a `DECIDED` entry, so later pushbacks can
cite it (PR #644: duplicate column `field` values).

**Final message:** one line per round (threads fixed / pushed back, pushed SHA), the final review's
verdict, and the `📦` line naming the amended commit's subject, marked as already pushed.

## Constraints

- **Resolving a thread ≠ closing the PR.** `resolveReviewThread` only collapses an
  individual thread. Never close, merge, approve, or mark the PR ready for review.
- **Remote writes are limited to step 4's list:** amend the PR's tip commit, push it with a
  SHA-pinned `--force-with-lease` to the PR's own head branch, request the Copilot reviewer,
  and reply to / resolve threads. Never use a bare `--force`, push to any other branch (least
  of all `main`), push tags, or rewrite commits below the tip.
- Put generated `*-threads.json` / `*-replies.json` files under `tmp/` (gitignored
  scratch), not in the repo tree.
- Use only these scripts (`gh` CLI) for thread I/O — never GitKraken MCP tools, which cannot
  reply inline, so per-thread responses get lost.
