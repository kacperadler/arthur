# AR0518 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A value split across two chunks of a job's output is not named

- Kind: security
- Found by: 2026-10-27-worker-28470be0 (worker), 2026-10-27
- Where: `packages/core/src/wrapper.ts:136`, `packages/core/src/job-install.ts:16`
- What: the wrapper names each env file value in each write to the record (`save`), and the agent's stderr and the install's output are written chunk by chunk as the pipe hands them over. A value that straddles two chunks (a 64 KiB pipe read ending inside it) lands in `log` as written. The agent's stdout is whole lines (`agentStream`), so it is not affected. Not reproduced; the pipe's chunking makes it rare.
- Suggestion: hold back the last `longest value - 1` characters of each stderr and install chunk until the next one or the pipe's end, then name and write them. Out: stdout, already whole lines.
- Status: fixed in 9e07ff35

## F2. A job on another machine writes its log and result without naming any value

- Kind: security
- Found by: 2026-10-27-worker-28470be0 (worker), 2026-10-27
- Where: `packages/core/src/wrapper.ts:63`, `packages/core/src/machine-sync.ts:65`
- What: the wrapper names the values of the env file its record's `guarded` names. On another machine that path is this machine's, so the wrapper there reads nothing and names nothing; the sweep then copies its `log`, `result` and `reason` into this home as written (`syncMachine`). The task, instructions and steers are named here before they go there, and no plugin's variable reaches that machine but a prepare's, so a value reaches that log only through a prepare's variable or the agent's own reading there.
- Suggestion: name the copied files with the loading process's `hide` in `syncMachine` before `write`/`appendFileSync`. Out: sending any value to the other machine.
- Status: open

## F3. A plugin's prompt section goes into the record's `prompt` as written

- Kind: security
- Found by: 2026-10-27-worker-28470be0 (worker), 2026-10-27
- Where: `packages/core/src/jobs.ts:175`
- What: the host names each value in a spawn's task, but the prompt is built from what the plugins' `prompt` providers answer and written into the record's `prompt` unchanged. No plugin puts a value there today [INFERENCE: from the providers read for this ticket, not a full audit].
- Suggestion: pass the host's `hide` to `jobRunner` and name `built.prompt` before `writeRecord`; this needs a line in `jobs.ts`, which is at 200 lines.
- Status: fixed in 9e07ff35

## F4. The worktree guard refuses `GIT_CONFIG_*=... git commit` but lets `export GIT_CONFIG_*=...; git commit` through

- Kind: security
- Found by: 2026-10-27-worker-28470be0 (worker), 2026-10-27
- Where: `packages/core/src/git-writes.ts:10`
- What: in this job, `GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=commit.gpgSign GIT_CONFIG_VALUE_0=false ... git commit -q -am "..."` was refused with the guard's line "this git call reads config the guard does not (... GIT_CONFIG* ...)", while `export GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=commit.gpgSign ...; git commit -q -am "..."` in one bash call committed (81feccc2). The guard reads the assignments that prefix the git word only, so config set by `export` earlier in the same call, or in an earlier call of the shell, reaches git unseen: an alias or `core.hooksPath` the guard never checks.
- Suggestion: count `export`/`declare -x` of `GIT_CONFIG*`, `HOME` and `XDG_CONFIG_HOME` earlier in the call as set for each git call after it, and refuse; a persistent shell's earlier calls stay out of reach (the sandbox's matter). Out: the owner's own unsigned commits (AR-D184), which the guard could allow for `commit.gpgSign` and `tag.gpgSign` alone.
- Status: open
