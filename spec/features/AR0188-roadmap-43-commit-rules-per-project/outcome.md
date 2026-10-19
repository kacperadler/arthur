# AR0188 - Outcome

- Merged: 2026-10-19, `72692ea`
- Branch: h/2026-10-19-ar0188-commit-rules-3a76b3d2
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $9.40, reviews $1.55; review rounds 3

## What went in

- The `commit-rules` plugin (roadmap 43): a project's `commitRules` (a regex, forbidden words, or a file of them) is enforced by a commit-msg hook in each job worktree's own Git folder, removed with the worktree; the main checkout is never hooked.
- A refused subject prints the rule; a merge commit is not checked; the project's own hooks still run after the rule passes; a hook that cannot be installed refuses the spawn and cleans up.
- `extensions.worktreeConfig` is set in the project's Git config, and a shared `core.bare` or `core.worktree` moves into `config.worktree`, as Git documents; `git init --bare` on a remote machine runs only when the repository has no `HEAD`.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 644/644 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0198 (F1), AR0199 (F2), AR0200 (F3), AR0201 (F5).
