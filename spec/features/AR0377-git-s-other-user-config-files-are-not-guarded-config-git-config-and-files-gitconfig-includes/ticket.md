# AR0377 - Git's other user config files are not guarded: `~/.config/git/config` and files `~/.gitconfig` includes

```json
{
  "id": "AR0377",
  "title": "Git's other user config files are not guarded: `~/.config/git/config` and files `~/.gitconfig` includes",
  "date": "2026-10-23"
}
```

## Description

a job's write to `~/.config/git/config` (git's XDG user config) or to a file `~/.gitconfig` includes changes git's identity and hooks for every checkout, as a write to `~/.gitconfig` would.

## Goal

Git's other user config (`~/.config/git/`) is guarded like `~/.gitconfig`, and the threat model says includes elsewhere are not followed; tested.

- Kind: risk

Evidence:
- the guarded places AR0329 adds (`~/.gitconfig` only); the worker's Known limit in `docs/deploy.md`
- Found by: 2026-10-23-review-ar0329-job-isolat-b49ac592 (review), 2026-10-23

## Done means

- The fix, with a test that proves it: guard `~/.config/git/` with the user's files, and say in the threat model that includes outside it are not followed.
- `npm test` and `npm run check` pass.

## Scope

In:
- guard `~/.config/git/` with the user's files, and say in the threat model that includes outside it are not followed.

## Decisions

- 2026-10-23: Source: F2 of AR0329
- 2026-10-23: Coordinator (free hand, finding ticket) approved; runs one at a time after the high-severity security fixes.
