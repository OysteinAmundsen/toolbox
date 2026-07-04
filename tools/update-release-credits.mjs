import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const monthlyPath = path.join(repoRoot, '.github/credits/monthly-subscribers.json');
const oneTimePath = path.join(repoRoot, '.github/credits/one-time-backers.json');
const issueStatePath = path.join(repoRoot, '.github/credits/issue-submitter-state.json');

const owner = process.env.GITHUB_REPOSITORY_OWNER;
const repo = process.env.GITHUB_REPOSITORY_NAME;
const token = process.env.GITHUB_TOKEN;
const baseRef = process.env.BASE_REF || 'main';
const cycleKey = process.env.CREDITS_CYCLE_KEY || process.env.GITHUB_REF_NAME || 'local';

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function run(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

function displayPerson(person) {
  const login = String(person?.login || '').trim();
  if (!login) return '';
  const label = person?.name ? `${person.name} (@${login})` : `@${login}`;
  if (person?.url) return `[${label}](${person.url})`;
  return label;
}

function uniquePeople(people) {
  const seen = new Set();
  const out = [];
  for (const person of people) {
    const login = String(person?.login || '')
      .trim()
      .toLowerCase();
    if (!login || seen.has(login)) continue;
    seen.add(login);
    out.push(person);
  }
  return out;
}

function parseLatestReleaseBlock(markdown) {
  const heading = /^## \[[^\]]+\][^\n]*$/m;
  const first = heading.exec(markdown);
  if (!first) return null;

  const start = first.index;
  const afterStart = start + first[0].length;
  const rest = markdown.slice(afterStart);
  const next = heading.exec(rest);
  const end = next ? afterStart + next.index : markdown.length;

  return {
    start,
    end,
    block: markdown.slice(start, end),
  };
}

function upsertCreditsSection(releaseBlock, creditsMarkdown) {
  const sectionHeader = '\n### ❤️ Community Thanks:\n';
  const existingStart = releaseBlock.indexOf(sectionHeader);
  if (existingStart === -1) {
    return `${releaseBlock.trimEnd()}\n${sectionHeader}\n${creditsMarkdown}\n\n`;
  }

  const afterHeader = existingStart + sectionHeader.length;
  const remainder = releaseBlock.slice(afterHeader);
  const nextSubHeadingMatch = /\n### [^\n]+\n/.exec(remainder);
  const existingEnd = nextSubHeadingMatch ? afterHeader + nextSubHeadingMatch.index : releaseBlock.length;

  return `${releaseBlock.slice(0, afterHeader)}\n${creditsMarkdown}\n\n${releaseBlock.slice(existingEnd).replace(/^\n+/, '')}`;
}

function extractIssueNumbers(text) {
  const set = new Set();
  const issueLinkRegex = /\(#(\d+)\)|\/issues\/(\d+)/g;
  let match = null;
  while ((match = issueLinkRegex.exec(text)) !== null) {
    const num = Number(match[1] || match[2]);
    if (Number.isInteger(num) && num > 0) set.add(num);
  }
  return [...set].sort((a, b) => a - b);
}

async function fetchIssueAuthor(issueNumber) {
  if (!owner || !repo || !token) return null;
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'toolbox-release-credits',
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const login = data?.user?.login;
  const htmlUrl = data?.user?.html_url;
  if (!login) return null;
  return { login, url: htmlUrl || `https://github.com/${login}` };
}

function buildCreditsMarkdown(monthly, oneTime, issueCredits) {
  const lines = [];

  if (monthly.length > 0) {
    lines.push(`- Monthly subscribers: ${monthly.map(displayPerson).filter(Boolean).join(', ')}`);
  }

  if (oneTime.length > 0) {
    lines.push(`- One-time backers: ${oneTime.map(displayPerson).filter(Boolean).join(', ')}`);
  }

  if (issueCredits.length > 0) {
    const formatted = issueCredits
      .map(
        (item) =>
          `${displayPerson(item.person)} for [#${item.issue}](https://github.com/${owner}/${repo}/issues/${item.issue})`,
      )
      .join(', ');
    lines.push(`- Issue submitters: ${formatted}`);
  }

  return lines.join('\n');
}

function getChangedChangelogs() {
  try {
    run(`git fetch --no-tags origin ${baseRef}`);
  } catch {
    // Continue with local refs if fetch fails in local runs.
  }

  const output = run(`git diff --name-only origin/${baseRef}...HEAD -- libs/*/CHANGELOG.md`);
  if (!output) return [];
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => file.endsWith('/CHANGELOG.md'));
}

async function main() {
  const monthlyData = readJson(monthlyPath, { subscribers: [] });
  const oneTimeData = readJson(oneTimePath, { backers: [] });
  const issueState = readJson(issueStatePath, { issues: {} });

  const monthly = uniquePeople(Array.isArray(monthlyData.subscribers) ? monthlyData.subscribers : []);
  const backers = Array.isArray(oneTimeData.backers) ? oneTimeData.backers : [];

  const eligibleBackers = uniquePeople(
    backers.filter((b) => {
      const status = (b?.status || 'pending').toLowerCase();
      return status === 'pending' || (status === 'credited' && b?.cycleKey === cycleKey);
    }),
  );

  const changelogFiles = getChangedChangelogs();
  if (changelogFiles.length === 0) {
    console.log('No changed changelog files found; skipping credits update.');
    return;
  }

  const nowIso = new Date().toISOString();
  let anyChanged = false;
  const touchedPendingBackers = new Set();

  for (const relativeFile of changelogFiles) {
    const fullPath = path.join(repoRoot, relativeFile);
    const original = fs.readFileSync(fullPath, 'utf8');
    const latest = parseLatestReleaseBlock(original);
    if (!latest) continue;

    const issueNumbers = extractIssueNumbers(latest.block);
    const issueCredits = [];

    for (const issueNumber of issueNumbers) {
      const key = String(issueNumber);
      const existing = issueState.issues?.[key];

      let person = null;
      if (existing?.login) {
        person = { login: existing.login, url: existing.url || `https://github.com/${existing.login}` };
      } else {
        person = await fetchIssueAuthor(issueNumber);
      }
      if (!person) continue;

      const allowed = !existing || existing.cycleKey === cycleKey;
      if (!allowed) continue;

      issueCredits.push({ issue: issueNumber, person });
      issueState.issues[key] = {
        login: person.login,
        url: person.url,
        cycleKey,
        creditedAt: nowIso,
      };
    }

    if (eligibleBackers.length > 0) {
      for (const b of eligibleBackers) {
        const login = String(b.login || '').trim();
        if (login) touchedPendingBackers.add(login.toLowerCase());
      }
    }

    const creditsMarkdown = buildCreditsMarkdown(monthly, eligibleBackers, issueCredits);
    if (!creditsMarkdown) continue;

    const updatedBlock = upsertCreditsSection(latest.block, creditsMarkdown);
    const updatedFile = `${original.slice(0, latest.start)}${updatedBlock}${original.slice(latest.end)}`;

    if (updatedFile !== original) {
      fs.writeFileSync(fullPath, updatedFile, 'utf8');
      anyChanged = true;
      console.log(`Updated credits in ${relativeFile}`);
    }
  }

  if (touchedPendingBackers.size > 0) {
    for (const backer of backers) {
      const login = String(backer?.login || '')
        .trim()
        .toLowerCase();
      if (!login || !touchedPendingBackers.has(login)) continue;

      const status = (backer.status || 'pending').toLowerCase();
      if (status === 'pending') {
        backer.status = 'credited';
        backer.cycleKey = cycleKey;
        backer.creditedAt = nowIso;
      }
    }
    writeJson(oneTimePath, { backers });
    anyChanged = true;
  }

  writeJson(issueStatePath, issueState);

  if (!anyChanged) {
    console.log('No changelog or state updates were needed.');
  }
}

await main();
