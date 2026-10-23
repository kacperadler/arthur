# AR0330 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A project on Git LFS gets its main pushed without its LFS objects

- Kind: risk
- Found by: 2026-10-23-ar0330-git-config-eb39f9d4 (worker), 2026-10-23
- Where: `packages/github/src/github-git.ts:38` (`push`), `packages/core/src/job-machine.ts:141` (`gitOver`)
- What: Arthur's own pushes now run with `-c core.hooksPath=/dev/null`, as this ticket's Done means asks, so no `pre-push` hook runs. Git LFS uploads a project's large files from its `pre-push` hook ([INFERENCE] from Git LFS's documented hooks; `git lfs` is not installed on this machine, so it was not run): `github.push` of main, or of a branch after a PASS, would leave origin with pointer files whose objects it never received. A project without LFS is unaffected.
- Suggestion: for a checkout whose `.gitattributes` names `filter=lfs`, run `git lfs push origin <ref>` before the push (Arthur's own program, not a hook the config names), or name LFS as unsupported in `docs/deploy.md`.
- Status: ticket AR0379

## F2. Arthur's git calls in a main checkout still run other programs its config names

- Kind: risk
- Found by: 2026-10-23-ar0330-git-config-eb39f9d4 (worker), 2026-10-23
- Where: `packages/delivery/src/merge-command.ts:58`, `packages/github/src/github-git.ts:38`, `packages/core/src/git.ts:9`
- What: the flags of this ticket turn off hooks and `core.fsmonitor` only. A program a job runs (`node -e`, which the worktree guard does not see) can still write the shared `.git/config` with `core.sshCommand` (run by `github.push` to an SSH origin; `gitOver` sets `GIT_SSH_COMMAND`, which wins), a `filter.<name>.clean`/`smudge` driver that a `.gitattributes` on the job's branch names (run by `arthur merge`'s merge and by a worktree's checkout), `gpg.program` with `commit.gpgSign` (run by the merge commit), or `credential.helper` (run by a push over HTTPS); each runs as Arthur, outside the job's scope.
- Suggestion: decide whether Arthur's main-checkout git calls should read the shared config at all: either pass each of these keys as `-c` too, or check `git config --local --list` against an allowed set before `arthur merge` and a push and refuse with the key named.
- Status: ticket AR0380

## F3. The worktree guard does not see a git alias or GIT_DIR

- Kind: risk
- Found by: 2026-10-23-ar0330-git-config-eb39f9d4 (worker), 2026-10-23
- Where: `packages/core/src/git-writes.ts:28` (`gitCall`), `packages/core/src/worktree-guard.ts:131` (`git`)
- What: probed with git 2.43 in a temporary repository and worktree: `git -c alias.c=config c a.c d` run in the worktree wrote `c = d` into the main checkout's `.git/config`; `GIT_DIR=<main>/.git git config --worktree a.c c` wrote the main checkout's own `config.worktree`. The guard takes `c` as the subcommand and the job's worktree as the place, so both pass. A job may also set `alias.c = config` with `git config --worktree`, which passes, and run `git c …` later. Named as a limit in `docs/deploy.md` and the guard's comment.
- Suggestion: in `gitCall`, resolve a `-c alias.<sub>=<value>` given on the same line; refuse a `--worktree` or `--file` write of an `alias.*` or `include*` key; take `GIT_DIR=`/`GIT_WORK_TREE=` assignments before `git` as `trees`. An `export GIT_DIR` in an earlier command, or an alias in `~/.gitconfig` the user already had, stays out of sight.
- Status: ticket AR0381

## F4. A job's repository on another machine runs its config's hooks in Arthur's git calls there

- Kind: risk
- Found by: 2026-10-23-ar0330-git-config-eb39f9d4 (worker), 2026-10-23
- Where: `packages/core/src/remote-job.ts:76`, `:78`, `:142`
- What: on another machine the jobs' worktrees share a bare repository (`repos/<project>.git`), and `arthur remote-job prune` runs `git worktree remove` and `git update-ref -d` there without `-c core.hooksPath=/dev/null -c core.fsmonitor=false`. This ticket covered a main checkout here only; a program a job runs there could set that repository's hooks and have Arthur run them at the prune.
- Suggestion: give `remote-job.ts`'s `git` helper and its `update-ref` the same two `-c` flags, with a test on the fake machine as in `machine.test.ts`.
- Status: ticket AR0382

## F5. The refusal test's count in the worker's message is off by one

- Kind: cleanup
- Found by: 2026-10-23-review-ar0330-git-config-e9ba03da (review), 2026-10-23
- Where: the worker's final message; `worktree-guard.test.ts` has 26 refused forms, not 27
- Status: dropped (the message only; the code and test are right)

## F6. An abbreviated `git config` option is refused even when its target is harmless

- Kind: risk
- Found by: 2026-10-23-review-ar0330-git-config-e9ba03da (review), 2026-10-23
- Where: `packages/core/src/git-writes.ts`, unknown options
- What: `--fil /tmp/x` is refused as a write to the main checkout; fail-closed by design.
- Status: dropped (fail-closed is the intended side; a job writes config in its own checkout with the full option)
