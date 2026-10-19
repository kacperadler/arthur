# AR0196 - Outcome

- Merged: 2026-10-19, `1556c9f`
- Branch: h/2026-10-19-ar0196-nvm-52bdb90d
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $8.13, reviews $1.60; review rounds 2

## What went in

- The `nvm` plugin (roadmap 84): at spawn, the Node version the worktree's `.nvmrc` names goes first on the job's PATH, as `nvm which` answers it on the job's machine; a missing nvm, a version not installed, or an unreadable `.nvmrc` refuses the spawn with the fix command. Arthur never installs a Node version itself (the owner, 2026-10-19).
- Each prepare gets the variables the prepares before it returned, and the projects install runs under nvm's PATH; a config that lists nvm after projects is refused at load.
- `arthur doctor` checks nvm on every machine; the `.nvmrc` that `arthur init` writes is now read (AR0184).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 665/665 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0207 (F1).
