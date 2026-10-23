# AR0329 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. Run each job's agent in a sandbox: the real bound the worktree guard is not

- Kind: risk
- Found by: 2026-10-23-ar0329-job-isolation-192f7a0b (worker), 2026-10-23
- Where: `packages/core/src/job-scope.ts:51` (the wrapper starts the agent as Arthur's Linux user, under a scope that caps CPU and memory only), `packages/core/src/worktree-guard.ts:53-61` (the guard's limits)
- What: the second step of AR0329, which its Done means gives its own ticket. The guard now refuses a tool call that writes into Arthur's install, the config's folder, the env file, `~/.ssh`, `~/.config/systemd` and `~/.gitconfig`, but it parses commands: a program the job runs that writes on its own (`node -e "require('fs').appendFileSync(process.env.HOME + '/.ssh/authorized_keys', 'k')"`, `python3 -c`, `tar -C ~ -x`), a path built at run time (`d=~/.ssh; echo k >> $d/authorized_keys`), and `git config --global` still reach all of them, and `systemd-run --user` from a job starts a process outside its scope.
- Suggestion: start each job's agent under a sandbox (bubblewrap or Landlock, or a Linux user per job) with the worktree and `/tmp` writable and the home folder, the config's folder, `~/.ssh` and the other checkouts read-only or hidden, and without the user manager's bus. It must keep what AR0329's Decision of 2026-10-23 keeps: the job's own worktree and branch (`arthur plugin new --root <worktree>` run from the main checkout), its review and merge, the coordinator outside the sandbox. Out: the guard's parser stays the mistake guard it is.
- Status: open

## F2. Git's other user config files are not guarded: `~/.config/git/config` and files `~/.gitconfig` includes

- Kind: risk
- Found by: 2026-10-23-review-ar0329-job-isolat-b49ac592 (review), 2026-10-23
- Where: the guarded places AR0329 adds (`~/.gitconfig` only); the worker's Known limit in `docs/deploy.md`
- What: a job's write to `~/.config/git/config` (git's XDG user config) or to a file `~/.gitconfig` includes changes git's identity and hooks for every checkout, as a write to `~/.gitconfig` would.
- Suggestion: guard `~/.config/git/` with the user's files, and say in the threat model that includes outside it are not followed.
- Status: open
