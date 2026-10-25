# AR0376 - Run each job's agent in a sandbox: the real bound the worktree guard is not

```json
{
  "id": "AR0376",
  "title": "Run each job's agent in a sandbox: the real bound the worktree guard is not",
  "date": "2026-10-23"
}
```

## Description

the second step of AR0329, which its Done means gives its own ticket. The guard now refuses a tool call that writes into Arthur's install, the config's folder, the env file, `~/.ssh`, `~/.config/systemd` and `~/.gitconfig`, but it parses commands: a program the job runs that writes on its own (`node -e "require('fs').appendFileSync(process.env.HOME + '/.ssh/authorized_keys', 'k')"`, `python3 -c`, `tar -C ~ -x`), a path built at run time (`d=~/.ssh; echo k >> $d/authorized_keys`), and `git config --global` still reach all of them, and `systemd-run --user` from a job starts a process outside its scope.

## Goal

Each job's agent runs in an OS sandbox (its worktree and record writable, Arthur's install, config, secrets and the user's files not), so the bound holds for scripts the command guard cannot read (`node -e`, `python3 -c`); the self-development path through a branch still works; tested.

- Kind: security

Evidence:
- `packages/core/src/job-scope.ts:51` (the wrapper starts the agent as Arthur's Linux user, under a scope that caps CPU and memory only), `packages/core/src/worktree-guard.ts:53-61` (the guard's limits)
- Found by: 2026-10-23-ar0329-job-isolation-192f7a0b (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: start each job's agent under a sandbox (bubblewrap or Landlock, or a Linux user per job) with the worktree and `/tmp` writable and the home folder, the config's folder, `~/.ssh` and the other checkouts read-only or hidden, and without the user manager's bus. It must keep what AR0329's Decision of 2026-10-23 keeps: the job's own worktree and branch (`arthur plugin new --root <worktree>` run from the main checkout), its review and merge, the coordinator outside the sandbox. Out: the guard's parser stays the mistake guard it is.
- `npm test` and `npm run check` pass.

## Scope

In:
- start each job's agent under a sandbox (bubblewrap or Landlock, or a Linux user per job) with the worktree and `/tmp` writable and the home folder, the config's folder, `~/.ssh` and the other checkouts read-only or hidden, and without the user manager's bus. It must keep what AR0329's Decision of 2026-10-23 keeps: the job's own worktree and branch (`arthur plugin new --root <worktree>` run from the main checkout), its review and merge, the coordinator outside the sandbox. Out: the guard's parser stays the mistake guard it is.

## Decisions

- 2026-10-23: Source: F1 of AR0329
- 2026-10-23: Coordinator (free hand, finding ticket) approved; runs one at a time after the high-severity security fixes.
- 2026-10-25: The human: try a third time, after the weekly usage limit resets (2026-10-28 09:00); the task is framed as a review and hardening of our own code, continuing branch h/2026-10-24-ar0376-job-sandbox-retry-6b3fc3f2 (82e69751).
