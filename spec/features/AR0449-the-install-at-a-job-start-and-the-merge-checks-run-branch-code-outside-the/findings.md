# AR0449 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The writable package caches carry branch code out of the sandbox

- Kind: security
- Found by: 2026-10-26-worker-bed8b28b (worker), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts` (`caches`)
- What: the install and the merge's checks write `~/.npm`, `~/.bun/install/cache` and the pnpm, uv and composer caches, which every job and Arthur's user share. A lifecycle script can write there what a later process outside any sandbox reads or runs: an `npx <package>` the coordinator or the owner runs takes `~/.npm/_npx/<hash>/node_modules` as it finds it. Not reproduced; read from npm's cache layout [INFERENCE].
- Suggestion: give each job and each merge its own cache (`npm_config_cache`, `BUN_INSTALL_CACHE_DIR`, `XDG_CACHE_HOME` pointed into the worktree or a per-job folder), at the cost of a cold cache per job; or leave `_npx` out of the writable paths. Out: changing what the agent itself may write.
- Status: ticket AR0454

## F2. A package cache that does not exist yet stays closed, so a fresh host's first install in a job fails

- Kind: ux
- Found by: 2026-10-26-worker-bed8b28b (worker), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts` (`caches`, the script's skip of a missing path)
- What: a writable path that is missing is skipped, so on a host where, say, `~/.npm` was never made, `npm ci` in a job's install or a merge's check cannot create it. Documented in `spawn.md` ("A cache folder not there yet is not made"); not run on a fresh host [INFERENCE: npm then fails with EACCES].
- Suggestion: `arthur doctor` names each missing cache of a manager the projects' lockfiles use, with `mkdir -p` as its fix; or `arthur setup` makes `~/.npm`. Making them at each spawn was left out: a test would then write into the real home folder.
- Status: ticket AR0455

## F3. The agent's own `npm ci` cannot write `~/.npm`

- Kind: fix
- Found by: 2026-10-26-worker-bed8b28b (worker), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts` (`writable`), `packages/core/roles/worker.md`
- What: in this job's sandbox `touch ~/.npm/_probe_x` gave `Permission denied`; the worker's role tells a job without an install to install from the lockfile itself, which then runs without a writable npm cache. What npm does then was not run.
- Suggestion: decide whether the agent gets the caches the install now gets (`caches()` added to `writable`), weighed against F1.
- Status: ticket AR0456

## F4. A merge check can leave a git hook or config in main's checkout, which runs outside the sandbox at the next git call

- Kind: security
- Found by: 2026-10-26-review-47ad9a71 (reviewer), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts:114` (`stepSandbox`), `packages/delivery/src/merge-command.ts:124`
- What: `stepSandbox` makes all of main's checkout writable, its `.git/hooks` and `.git/config` included; the agent's sandbox writes only `.git`'s objects, refs and logs. The reviewer ran a throwaway script: a step in a set-up sandbox wrote `.git/hooks/post-commit` and set `core.fsmonitor`, exit 0, both still there after; `git reset --keep` after a failed check does not undo them. The owner's next own `git status` or `git commit` in that checkout runs the planted code outside any sandbox, where it reads `arthur run`'s environment and the env file. Where `core.home` or `arthur.config.ts` sit inside the checkout, the step can write those too.
- Suggestion: give each merge step the agent's write rules for `.git` (objects, refs, logs only), and the checkout's files outside `.git` minus Arthur's own home and config. Out: the git-config limit `docs/deploy.md` already names for jobs.
- Status: ticket AR0457


## F5. An install can remove the env file from the record's guarded list, so the agent reads it

- Kind: security
- Found by: 2026-10-26-review-47ad9a71 (reviewer), 2026-10-26
- Where: `packages/core/src/wrapper.ts:123` and `:128`
- What: the install's writable paths include the job's record folder, and the agent's sandbox re-reads `hidden(folder)` from the record's `guarded` file after the install. A lifecycle script that removes the `env /...` line from `guarded` leaves the env file readable to the agent and to every tool call of the job (a dependency's code during `npm test`). Not run; read from the two lines [INFERENCE]. The agent could already do this across a `continue`.
- Suggestion: compute `hidden(folder)` once before the install and reuse it, or leave the record out of the install's writable paths; a test where the install empties `guarded` and the agent still gets `EACCES`. Out: the agent's own writes to its record across a `continue`.
- Status: ticket AR0458
