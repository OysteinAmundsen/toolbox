# Release Credits Configuration

This folder controls automated credits inserted into the newest release section
of each changed package changelog during release-please PRs.

The inserted section heading is `### Community Thanks`.

## Files

- `monthly-subscribers.json`
  - Included on every release cycle.
  - Schema:
    - `subscribers`: array of `{ "login": string, "name"?: string, "url"?: string }`

- `one-time-backers.json`
  - Included for one release cycle only.
  - Schema:
    - `backers`: array of
      - required: `login`
      - optional: `name`, `url`
      - managed by automation: `status` (`pending` | `credited`), `cycleKey`, `creditedAt`

- `issue-submitter-state.json`
  - Tracks issue numbers already credited for a specific release cycle.
  - Supports submitter opt-out via `skipLogins`.
  - Managed by automation.
  - Schema:
    - `skipLogins`: array of GitHub logins to never mention in changelog credits
    - `issues`: issue tracking map maintained by automation

## Usage

1. Add monthly supporters to `monthly-subscribers.json`.
2. Add new one-time backers to `one-time-backers.json` with only `login` (and optionally `name`, `url`).
3. Optional: add GitHub logins to `issue-submitter-state.json.skipLogins` when users prefer not to be credited.
4. Release-please PR updates changelogs automatically via `.github/workflows/release-credits.yml`.

## Workflow Triggering

- The workflow runs on `workflow_run` after `CI` completes successfully for pushes to `main`/`2.x`, then checks out the corresponding release-please branch (`release-please--branches--<base>`).
- This avoids relying only on `pull_request` events, which may not fire when branches/PRs are created by another workflow using `GITHUB_TOKEN`.

## Notes

- One-time backers are marked `credited` for the current release cycle and are not repeated on future cycles.
- Issue submitters are credited by issue number and also constrained to one release cycle.
- Issue submitters are auto-detected from issue links already present in the latest changelog entry; no manual issue list is needed.
- Logins listed in `skipLogins` are always excluded from issue-submitter credits.
- Re-runs in the same release cycle are idempotent and keep the same credits stable.
