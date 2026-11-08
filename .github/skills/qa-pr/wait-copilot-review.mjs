#!/usr/bin/env node
//
// Request a GitHub Copilot code review on a pull request and wait until Copilot
// submits a review for the PR's CURRENT head commit, then print its body.
//
// Copilot reviews arrive as ordinary pull request reviews from
// `copilot-pull-request-reviewer[bot]`, carrying the reviewed `commit_id`, so
// "done" = a Copilot review whose commit_id equals the head SHA. A review takes
// roughly 5–15 minutes.
//
// Usage:
//   bun .github/skills/qa-pr/wait-copilot-review.mjs <pr> [--request] [--timeout <minutes>] [--repo owner/name]
//     --request          first run `gh pr edit <pr> --add-reviewer @copilot` (a remote write:
//                        only with the user's consent for this round)
//     --timeout <min>    give up after this many minutes (default 25)
//     --repo o/n         target repo (default: auto-detected via `gh repo view`)
//
// Exit 0 = review found (printed). Exit 1 = timeout. Exit 2 = bad arguments.
// Requires: gh (authenticated). No jq needed.
import { execFileSync } from 'node:child_process';

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

const argv = process.argv.slice(2);
const pr = argv.find((a) => /^\d+$/.test(a));
if (!pr) {
  console.error('Usage: wait-copilot-review.mjs <pr> [--request] [--timeout <minutes>] [--repo owner/name]');
  process.exit(2);
}
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const repo =
  flag('--repo') ?? process.env.GH_REPO ?? JSON.parse(gh(['repo', 'view', '--json', 'nameWithOwner'])).nameWithOwner;
const timeoutMs = Number(flag('--timeout') ?? 25) * 60_000;

if (argv.includes('--request')) gh(['pr', 'edit', pr, '--repo', repo, '--add-reviewer', '@copilot']);

const head = JSON.parse(gh(['pr', 'view', pr, '--repo', repo, '--json', 'headRefOid'])).headRefOid;
console.log(`Waiting for a Copilot review of ${head.slice(0, 8)} on ${repo}#${pr}`);
const start = Date.now();
while (Date.now() - start < timeoutMs) {
  const reviews = JSON.parse(gh(['api', `repos/${repo}/pulls/${pr}/reviews`, '--paginate', '--slurp'])).flat();
  const review = reviews.filter((r) => /copilot/i.test(r.user?.login ?? '') && r.commit_id === head).at(-1);
  if (review) {
    console.log(`REVIEW ${review.id} ${review.state} ${review.submitted_at}`);
    console.log(review.body);
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 30_000));
}
console.log('TIMEOUT');
process.exit(1);
