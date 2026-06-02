#!/usr/bin/env node
//
// Fetch all review threads for a GitHub pull request as normalized JSON.
//
// Inline PR review comments live in "review threads". Each thread has a GraphQL
// node id (PRRT_...) used to resolve it, and its first comment has a numeric
// databaseId used to post an inline reply. This script paginates through every
// thread and prints a flat JSON array with exactly the fields you need:
//
//   { threadId, commentId, author, path, line, isResolved, isOutdated, body }
//
// Usage:
//   bun .github/skills/pr-comments/fetch-threads.mjs <pr> [--all] [--repo owner/name]
//     --all          include resolved threads too (default: unresolved only)
//     --repo o/n     target repo (default: auto-detected via `gh repo view`)
//
// Examples:
//   bun .github/skills/pr-comments/fetch-threads.mjs 347
//   bun .github/skills/pr-comments/fetch-threads.mjs 347 --all > tmp/pr347-threads.json
//
// Requires: gh (authenticated). No jq needed.
import { execFileSync } from 'node:child_process';

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function parseArgs(argv) {
  const out = { pr: null, all: false, repo: process.env.GH_REPO ?? null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') out.all = true;
    else if (a === '--repo') out.repo = argv[++i];
    else if (a === '-h' || a === '--help') out.help = true;
    else if (out.pr === null) out.pr = a;
  }
  return out;
}

const QUERY = `
query($owner:String!,$name:String!,$pr:Int!,$cursor:String){
  repository(owner:$owner,name:$name){
    pullRequest(number:$pr){
      reviewThreads(first:100, after:$cursor){
        pageInfo{ hasNextPage endCursor }
        nodes{
          id isResolved isOutdated path line
          comments(first:1){ nodes{ databaseId author{login} body } }
        }
      }
    }
  }
}`;

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.pr === null) {
    console.error('usage: fetch-threads.mjs <pr> [--all] [--repo owner/name]');
    process.exit(args.help ? 0 : 1);
  }

  const repo = args.repo ?? gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim();
  const [owner, name] = repo.split('/');

  const threads = [];
  let cursor = null;
  do {
    const cursorArg = cursor === null ? ['-F', 'cursor=null'] : ['-f', `cursor=${cursor}`];
    const raw = gh([
      'api',
      'graphql',
      '-f',
      `query=${QUERY}`,
      '-f',
      `owner=${owner}`,
      '-f',
      `name=${name}`,
      '-F',
      `pr=${args.pr}`,
      ...cursorArg,
    ]);
    const page = JSON.parse(raw).data.repository.pullRequest.reviewThreads;
    threads.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor !== null);

  const normalized = threads
    .filter((t) => args.all || t.isResolved === false)
    .map((t) => {
      const first = t.comments.nodes[0] ?? {};
      return {
        threadId: t.id,
        commentId: first.databaseId ?? null,
        author: first.author?.login ?? null,
        path: t.path,
        line: t.line,
        isResolved: t.isResolved,
        isOutdated: t.isOutdated,
        body: first.body ?? '',
      };
    });

  process.stdout.write(JSON.stringify(normalized, null, 2) + '\n');
}

main();
