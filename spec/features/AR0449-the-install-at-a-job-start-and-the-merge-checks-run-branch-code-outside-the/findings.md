# AR0449 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The writable package caches carry branch code out of the sandbox

- Kind: security
- Found by: 2026-10-26-worker-bed8b28b (worker), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts` (`caches`)
- What: the install and the merge's checks write `~/.npm`, `~/.bun/install/cache` and the pnpm, uv and composer caches, which every job and Arthur's user share. A lifecycle script can write there what a later process outside any sandbox reads or runs: an `npx <package>` the coordinator or the owner runs takes `~/.npm/_npx/<hash>/node_modules` as it finds it. Not reproduced; read from npm's cache layout [INFERENCE].
- Suggestion: give each job and each merge its own cache (`npm_config_cache`, `BUN_INSTALL_CACHE_DIR`, `XDG_CACHE_HOME` pointed into the worktree or a per-job folder), at the cost of a cold cache per job; or leave `_npx` out of the writable paths. Out: changing what the agent itself may write.
- Status: open

## F2. A package cache that does not exist yet stays closed, so a fresh host's first install in a job fails

- Kind: ux
- Found by: 2026-10-26-worker-bed8b28b (worker), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts` (`caches`, the script's skip of a missing path)
- What: a writable path that is missing is skipped, so on a host where, say, `~/.npm` was never made, `npm ci` in a job's install or a merge's check cannot create it. Documented in `spawn.md` ("A cache folder not there yet is not made"); not run on a fresh host [INFERENCE: npm then fails with EACCES].
- Suggestion: `arthur doctor` names each missing cache of a manager the projects' lockfiles use, with `mkdir -p` as its fix; or `arthur setup` makes `~/.npm`. Making them at each spawn was left out: a test would then write into the real home folder.
- Status: open

## F3. The agent's own `npm ci` cannot write `~/.npm`

- Kind: fix
- Found by: 2026-10-26-worker-bed8b28b (worker), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts` (`writable`), `packages/core/roles/worker.md`
- What: in this job's sandbox `touch ~/.npm/_probe_x` gave `Permission denied`; the worker's role tells a job without an install to install from the lockfile itself, which then runs without a writable npm cache. What npm does then was not run.
- Suggestion: decide whether the agent gets the caches the install now gets (`caches()` added to `writable`), weighed against F1.
- Status: open
