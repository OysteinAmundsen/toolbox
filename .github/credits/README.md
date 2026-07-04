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
  - Managed by automation.

## Usage

1. Add monthly supporters to `monthly-subscribers.json`.
2. Add new one-time backers to `one-time-backers.json` with only `login` (and optionally `name`, `url`).
3. Release-please PR updates changelogs automatically via `.github/workflows/release-credits.yml`.

## Notes

- One-time backers are marked `credited` for the current release cycle and are not repeated on future cycles.
- Issue submitters are credited by issue number and also constrained to one release cycle.
- Re-runs in the same release cycle are idempotent and keep the same credits stable.
