---
name: qa-apply-findings
description: Shared execution core for QA workflows. Apply a normalized findings list, validate changes, and produce a structured result that can be used by both local `/qa` and reactive `/pr-qa` flows.
---

# Apply QA Findings (Shared Core)

Use this skill when findings already exist and the goal is execution, not discovery.

- `/qa` flow: local review discovers findings -> this skill applies them.
- `/pr-qa` flow: PR comment triage produces findings -> this skill applies them.

## Input Contract

Provide a findings JSON file that matches:

- `.github/skills/qa-apply-findings/findings.schema.json`
- Start from `.github/skills/qa-apply-findings/findings.template.json`

Each finding must include severity, location, problem statement, and expected change.
For PR-thread sourced findings, include `thread.threadId` and `thread.commentId` so
reply payloads can be generated after fixes.

## Execution Steps

1. Load matching workspace conventions (`copilot-instructions`, instruction files, knowledge files).
2. Prioritize findings by severity (`blocking` first, then `should-fix`).
3. Implement fixes with minimal scope changes.
4. Re-validate per finding with lightweight checks, then run project-level validation.
5. Produce an execution summary and a machine-usable output JSON.

## Validation

Use Nx commands for project validation where applicable:

- `bun nx affected -t lint,test`
- Fallback to per-project `bun nx lint <project>` and `bun nx test <project>` when needed.

## Output Contract

Return:

- `applied`: list of finding IDs fixed
- `deferred`: list of finding IDs not fixed + reason
- `validation`: commands run + pass/fail
- `replyItems` (optional): array matching `.github/skills/pr-comments/reply-items` shape for PR thread replies

Use `.github/skills/qa-apply-findings/summary.template.md` as the summary structure.

## Constraints

- Do not run `git commit`, `git push`, or PR merge commands.
- Do not expand scope beyond findings unless explicitly requested.
- Preserve existing public APIs unless a finding requires a behavioral/API fix.
