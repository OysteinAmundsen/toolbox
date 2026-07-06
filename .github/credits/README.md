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
  - Supports maintainer exclusion via `maintainerLogins`.
  - Managed by automation.
  - Schema:
    - `maintainerLogins`: array of maintainer GitHub logins to exclude from community thanks
    - `skipLogins`: array of GitHub logins to never mention in changelog credits
    - `issues`: issue tracking map maintained by automation

## Usage

1. Add monthly supporters to `monthly-subscribers.json`.
2. Add new one-time backers to `one-time-backers.json` with only `login` (and optionally `name`, `url`).
3. Optional: add maintainer GitHub logins to `issue-submitter-state.json.maintainerLogins` to exclude maintainer-authored issues from community thanks.
4. Optional: add GitHub logins to `issue-submitter-state.json.skipLogins` when users prefer not to be credited.
5. Release-please PR updates changelogs automatically via the `release-credits` job inside `.github/workflows/ci.yml`.

## Workflow Triggering

- The credits updater runs as a dedicated `release-credits` job inside `CI`, after the `release-please` job on pushes to `main`/`2.x`.
- Keeping release-please and credits in one workflow avoids cross-workflow trigger gaps that happen with bot-generated events.

## Notes

- One-time backers are marked `credited` for the current release cycle and are not repeated on future cycles.
- Issue submitters are credited by issue number and also constrained to one release cycle.
- Issue submitters are auto-detected from issue links already present in the latest changelog entry; no manual issue list is needed.
- Repo owner is treated as a maintainer by default and excluded from issue-submitter community thanks.
- Logins listed in `maintainerLogins` are excluded from issue-submitter community thanks.
- Logins listed in `skipLogins` are always excluded from issue-submitter credits.
- If filtering leaves no eligible entries, the existing `❤️ Community Thanks` section is removed from that release block.
- Re-runs in the same release cycle are idempotent and keep the same credits stable.
