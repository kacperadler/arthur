# AR0456 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The agent's bun, pnpm, uv and composer still have no writable cache

- Kind: fix
- Found by: 2026-10-28-worker-0197a47f (worker), 2026-10-28
- Where: `packages/core/src/wrapper.ts:129`, `packages/core/src/job-sandbox.ts:106` (`cached`)
- What: the agent now gets the record's npm cache (`npm_config_cache`, AR0456), but not the other variables the install gets (`BUN_INSTALL_CACHE_DIR`, `XDG_CACHE_HOME`, `PNPM_HOME`, `COMPOSER_CACHE_DIR`); in a job's sandbox `~/.bun/install/cache`, `~/.cache`, `~/.local/share/pnpm` and `~/.composer/cache` are read-only, so an agent that installs with bun, pnpm, uv or composer itself fails as npm did [INFERENCE: from `writable`, which grants none of them; not run with those tools].
- Suggestion: give the agent the same variables as the install, from one function both use. Weigh `XDG_CACHE_HOME` first: it moves every XDG-aware tool's cache, omp's own included if it keeps one there, so each job would start with an empty one.
- Status: open

## F2. Inside a job's sandbox the agent cannot read or stop a command omp moved to the background

- Kind: fix
- Found by: 2026-10-28-worker-0197a47f (worker), 2026-10-28
- Where: `packages/core/src/job-sandbox.ts:9-15` (the seccomp filter that refuses a Unix stream socket)
- What: omp moves a long `bash` call (here `npm test`) to the background as `bg_<n>`; reading `proc://bg_1` or writing `proc://bg_1/kill` from a job's agent failed with `Failed to start daemon broker at ~/.omp/run/daemons/<hash>/broker.sock after 10s: connect EACCES`. So a worker cannot wait on its own suite run in the same turn, only end its turn and be woken; the result does arrive as an injected notice.
- Suggestion: let omp's broker socket through, as omp's session lock's datagram socket is (AR0406), or keep long commands in the foreground for a job's agent; the first widens what a job reaches outside its sandbox (the broker runs outside it), so it needs weighing.
- Status: open

## F3. The merge step timeout test fails under load: its 3 s limit also catches `npm run check`

- Kind: test
- Found by: 2026-10-28-worker-0197a47f (worker), 2026-10-28
- Where: `packages/delivery/test/merge.test.ts:593-608`
- What: with load average about 40 on the host, `npm test` failed this one test: `actual: 'arthur merge: check failed on main (npm run check, npm test); ...'`, `expected: '... (npm test); ...'`; `npm run check` (`node -e ""` in a sandbox and scope) took over the 3 s `stepSeconds` the test sets for all steps. Run alone a minute later (load about 24) it passed in 6.9 s: `node --test --test-name-pattern="a step still running at merge.stepSeconds" packages/delivery/test/merge.test.ts`.
- Suggestion: give the test a limit the fast steps never reach under load, such as 15 s (the slow step's own timer, 60 s, stays above it); the test's run time grows by the same amount.
- Status: open
