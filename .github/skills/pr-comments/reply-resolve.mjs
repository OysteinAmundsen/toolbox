#!/usr/bin/env node
//
// Post inline replies to PR review threads and (optionally) resolve them.
//
// Reads an items file describing one action per thread, posts each reply on the
// correct review comment via the REST replies endpoint, then resolves the thread
// via the resolveReviewThread GraphQL mutation.
//
// IMPORTANT: resolving a thread only collapses that individual review thread.
// It does NOT close, merge, or approve the pull request.
//
// Items file — a JSON array (e.g. tmp/pr347-replies.json):
//   [
//     { "commentId": 3289521091, "threadId": "PRRT_kwDOQtIN_86EKNlu",
//       "body": "Fixed. Typed the option as `HTMLOptionElement` (L1679)." }
//   ]
// Each element needs: commentId (number), threadId (string), body (string).
//
// Usage:
//   bun .github/skills/pr-comments/reply-resolve.mjs <pr> <items.json> [options]
//     --no-resolve   post replies but leave threads open
//     --dry-run      print what would happen; make no API calls
//     --repo o/n     target repo (default: auto-detected via `gh repo view`)
//
// Example:
//   bun .github/skills/pr-comments/reply-resolve.mjs 347 tmp/pr347-replies.json
//
// Requires: gh (authenticated). No jq needed.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

function parseArgs(argv) {
  const out = { pr: null, items: null, repo: process.env.GH_REPO ?? null, resolve: true, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-resolve') out.resolve = false;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--repo') out.repo = argv[++i];
    else if (a === '-h' || a === '--help') out.help = true;
    else if (out.pr === null) out.pr = a;
    else if (out.items === null) out.items = a;
  }
  return out;
}

const RESOLVE_MUTATION = 'mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}';

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.pr === null || args.items === null) {
    console.error('usage: reply-resolve.mjs <pr> <items.json> [--repo owner/name] [--no-resolve] [--dry-run]');
    process.exit(args.help ? 0 : 1);
  }

  let items;
  try {
    items = JSON.parse(readFileSync(args.items, 'utf8'));
  } catch (err) {
    console.error(`cannot read items file ${args.items}: ${err.message}`);
    process.exit(1);
  }

  const valid =
    Array.isArray(items) &&
    items.every(
      (it) => it && typeof it.commentId === 'number' && typeof it.threadId === 'string' && typeof it.body === 'string',
    );
  if (!valid) {
    console.error('invalid items file: expected a JSON array of { commentId:number, threadId:string, body:string }');
    process.exit(1);
  }

  const repo = args.repo ?? gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim();

  console.error(
    `Processing ${items.length} thread(s) on ${repo} PR #${args.pr} (resolve=${args.resolve}, dry-run=${args.dryRun})`,
  );

  for (const it of items) {
    console.error(`-> reply to comment ${it.commentId} (thread ${it.threadId})`);
    if (args.dryRun) {
      console.error(`   [dry-run] POST repos/${repo}/pulls/${args.pr}/comments/${it.commentId}/replies`);
    } else {
      const res = gh([
        'api',
        `repos/${repo}/pulls/${args.pr}/comments/${it.commentId}/replies`,
        '-f',
        `body=${it.body}`,
      ]);
      console.error(`   replied id=${JSON.parse(res).id}`);
    }

    if (args.resolve) {
      console.error(`   resolve thread ${it.threadId}`);
      if (args.dryRun) {
        console.error(`   [dry-run] resolveReviewThread(${it.threadId})`);
      } else {
        const res = gh(['api', 'graphql', '-f', `query=${RESOLVE_MUTATION}`, '-f', `id=${it.threadId}`]);
        const isResolved = JSON.parse(res).data.resolveReviewThread.thread.isResolved;
        console.error(`   resolved=${isResolved}`);
      }
    }
  }

  console.error('Done.');
}

main();
