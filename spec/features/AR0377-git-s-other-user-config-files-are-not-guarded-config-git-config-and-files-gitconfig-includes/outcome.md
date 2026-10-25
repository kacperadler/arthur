# AR0377 - Outcome

- Merged: 2026-10-25, `ac8bf33e`
- Branch: h/2026-10-24-ar0377-git-config-guard-55ed335e
- Reviews: review-1.md PASS; merged unreviewed (--unreviewed): no PASS on 26c6a3c (last PASS: 070f6e7, 2 commits since)
- Cost: worker $1.90, reviews $0.58; review rounds 1

## What went in

- `packages/core/src/job-place.ts`: `guardedPlaces` writes a `gitxdg` line for `~/.config/git/`, and a second one for `$XDG_CONFIG_HOME/git/` when it points elsewhere, so the worktree guard refuses a job's write into the user's Git config there; a file the user's Git config includes is not followed (said in its comment).
- `packages/core/src/worktree-guard.ts`: its header lists the user's Git config among the guarded places.
- `docs/deploy.md`: the threat model lists `~/.gitconfig`, `~/.config/git/`, `$XDG_CONFIG_HOME/git/`, and says included files are not followed.
- Tests: `worktree-guard.test.ts` checks refused and allowed writes for each XDG value; `machine.test.ts` knows the `gitxdg` key.
- `findings.md`: F1 (systemd under XDG_CONFIG_HOME), F2 (AR0387's Kind line).

## Checks on main

- `npm run check`: passed.
- `npm test`: 1076/1076 passed.
- CI ci: pending https://github.com/kacperadler/arthur/actions/runs/40136423128

## Left open

- Tickets from findings: AR0388 (F1). F2 fixed on main (d1877289); AR0389 dropped.
