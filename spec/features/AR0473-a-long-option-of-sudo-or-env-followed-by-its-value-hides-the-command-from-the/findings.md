# AR0473 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A long option of the other wrappers followed by its value still hides the command

- Kind: security
- Found by: 2026-10-27-worker-67871c96 (worker), 2026-10-27
- Where: `packages/core/src/worktree-guard.ts:20` (`WRAPPERS`: only sudo and env list their long options)
- What: `timeout --signal KILL 60 rm <main>/README.md` passes the guard: a row expecting the main checkout, added for a run of `node --test packages/core/test/worktree-guard.test.ts` and removed after, failed with `undefined`; real `timeout --signal KILL 5 echo timeout-ran` printed `timeout-ran`. The same holds, from the lines of `commandIndex`, for `timeout --kill-after`, `nice --adjustment`, `ionice --class`/`--classdata`/`--pid`/`--pgid`/`--uid`, `stdbuf --input`/`--output`/`--error`, GNU `time --format`/`--output` and the long options of `xargs` that take a value (an inference, not run).
- Suggestion: list those wrappers' long options in `WRAPPERS` as sudo and env now are (`=` after those that take a value); `commandIndex` already reads them, prefixes included. A row each in `worktree-guard.test.ts`.
- Status: open

## F2. The command line `env -S` splits is not read

- Kind: security
- Found by: 2026-10-27-worker-67871c96 (worker), 2026-10-27
- Where: `packages/core/src/worktree-guard.ts:20` (`-S` and `--split-string=` are skipped as an option value)
- What: `env -S 'rm <main>/README.md'` passes the guard: a row expecting the main checkout, added for a run of `node --test packages/core/test/worktree-guard.test.ts` and removed after, failed with `undefined`; real `env -S 'echo split-ran'` printed `split-ran`. env splits the value into words and runs them, the words after it appended.
- Suggestion: read the value of `env -S`/`--split-string` as the start of the command (split as `bash -c` text is, before the words after it), or refuse an `env -S` whose value the guard cannot split; a row each.
- Status: open
