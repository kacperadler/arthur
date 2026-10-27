# AR0509 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The copy's fetch of an ended job's branch, and the spawn's SSH steps, still block `arthur run` with no time limit

- Kind: security
- Found by: 2026-10-27-worker-61d50fad (worker), 2026-10-27
- Where: `packages/core/src/machine-sync.ts:66` (`gitOver(... "fetch" ...)` in `syncMachine`, run by the sweep), `packages/core/src/job-machine.ts:143-149` (`gitOver`: `spawnSync` of git over ssh, no `timeout`), `:114-122` (`ssh`: `spawnSync`, no `timeout`, default `maxBuffer` of 1 MiB), used by `reach`, `addThere`, `removeThere` and `launchThere` (`machine-sync.ts:103`) and by prune
- What: the copy itself is now bounded (AR0509), but once it finds a run ended there it fetches the branch with a synchronous git over ssh, bounded only by `ConnectTimeout=10`; a machine whose network drops mid-fetch, or whose `git upload-pack` never ends, freezes `arthur run`'s event loop (Telegram, `/stopall`, every plugin) until the call ends. A spawn or prune on such a machine does the same through the sync `ssh()`. [INFERENCE: from the code; not run against a hanging machine.]
- Suggestion: run these steps asynchronously with a time limit (as `execute` does for `sshAsync`), a timeout counted as the machine unreachable; the fetch first, as the sweep runs it every 30 s. Out: the copy, done here.
- Status: open

## F2. A machine with many jobs whose logs grew a lot may not fit its copy in 20 s over a slow link, and counts as offline

- Kind: fix
- Found by: 2026-10-27-worker-61d50fad (worker), 2026-10-27
- Where: `packages/core/src/remote-job.ts:23` (`LOG_BYTES`, per job), `packages/core/src/machine-sync.ts:29` (`COPY_SECONDS`)
- What: `records` caps the log at 256 KiB per job, not per answer: ten jobs each behind by that much send about 2.5 MiB (more with JSON escaping), which needs about 1 Mbit/s to arrive within the 20 s limit. Below that every sweep times out, the machine counts as unreachable, nothing is copied (`synced` does not move), and its jobs end `failed: machine offline` past the grace although the machine answers. [INFERENCE: arithmetic from the two constants; not run over a slow link.]
- Suggestion: a budget for the whole answer as well, shared out among the jobs asked, so a copy always moves on; or a limit that grows with the bytes asked. Out: the per-job cut, which stays.
- Status: open

## F3. `arthur run`'s stop does not wait for a sweep's copy still in flight

- Kind: fix
- Found by: 2026-10-27-worker-61d50fad (worker), 2026-10-27
- Where: `packages/core/src/run.ts:50` (`setInterval(() => Promise.try(sweep)...)`), `:89-90` (`clearInterval`, then `lock.release()`)
- What: the copy is now asynchronous (AR0509), up to 20 s per machine. A SIGTERM during one clears the interval and releases `run.pid` while that copy still runs; it writes records after the lock is gone, possibly beside a new `arthur run`'s first sweep. The copy's check of `synced` before it writes (`machine-sync.ts:58`) keeps a log from being appended twice, but the two may still move one job's state each. [INFERENCE: from the code; not run.]
- Suggestion: keep the sweep's promise in `runPlugins` and await it before the lock is released. Out: the copy itself.
- Status: open
