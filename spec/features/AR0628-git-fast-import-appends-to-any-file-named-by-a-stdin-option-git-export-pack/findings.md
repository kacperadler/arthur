# AR0628 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The guard does not judge the command after `coproc`

- Kind: security
- Found by: 2026-11-06-worker-63366938 (worker), 2026-11-06
- Where: `packages/core/src/command-index.ts:4`
- What: `coproc` is neither a wrapper nor a reserved word to `commandIndex`, so the guard reads `coproc` as the command and judges nothing after it. In a throwaway row of `packages/core/test/worktree-guard.test.ts`, both `coproc git -C /tmp/other fast-import` and `coproc F { git -C /tmp/other fast-import; }` passed the guard (refusal `undefined`); a coprocess's stdin is then written through `>&${F[1]}`, which holds no pipe or `<`. [INFERENCE] any other write after `coproc` (`coproc rm <main>/README.md`) passes the same way.
- Suggestion: read `coproc` as a wrapper in `command-index.ts` (`coproc cmd …` runs `cmd`), and its `NAME { … }` form as the group it runs, with guard rows for both; then count `coproc` in `fed` (`bash-refusal.ts`) as a stdin the call feeds.
- Status: deferred (client summary)

## F2. A plain fast-import's stdin can still come from outside the call

- Kind: security
- Found by: 2026-11-06-worker-63366938 (worker), 2026-11-06
- Where: `packages/core/src/bash-refusal.ts:129`
- What: the ticket keeps a plain `git -C /tmp/other fast-import` allowed, and the guard judges one call at a time. Its stdin can still be fed from outside the call: an `exec < file` or a function `f() { git -C /tmp/other fast-import; }` from an earlier call of a persistent shell, then `f < file` or a plain call; or the agent writing to a background service's stdin. An `option git export-pack-edges=<path>` line there still appends to any file. Not run; read from the guard judging each call alone (`bashRefusal`).
- Suggestion: refuse `fast-import` on any repository (the ticket's other option), or leave it to the sandbox, which bounds every write of a job's processes (`docs/deploy.md`, the sandbox paragraph), as AR0524 did for config exported in an earlier call.
- Status: deferred (client summary)

## F3. `coproc` feeds fast-import's stdin unseen

- Kind: security
- Found by: 2026-11-06-review-eaea6382 (review), 2026-11-06
- Where: `packages/core/src/bash-refusal.ts:129`
- What: `coproc git -C /tmp/other fast-import` passes the guard; this is already filed as F1 in the ticket's findings.md.
- Status: deferred (client summary)
