# AR0524 - Outcome

- Merged: 2026-10-28, `ee5ef763`
- Branch: arthur/2026-10-28-worker-bd3b91f9
- Reviews: review-1.md PASS
- Cost: worker $1.78, reviews $1.04; review rounds 1

## What went in

- The worktree guard now refuses a git call when the same bash call set `GIT_CONFIG_*`, `HOME` or `XDG_CONFIG_HOME` earlier, by a bare assignment or by `export`, `declare`, `typeset`, `readonly` or `local`, with the same refusal the form written in front of `git` gets. It errs toward refusing: a value set inside a subshell still counts.
- An append (`HOME+=x`) and an index (`HOME[0]=x`) of those variables now count too, also in front of `git`.
- `docs/deploy.md` says config set earlier in the same call is refused.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1163/1230 passed.

## Left open

- Tickets from findings: AR0545 (F1, F2), AR0546 (F3); F4 dropped.
