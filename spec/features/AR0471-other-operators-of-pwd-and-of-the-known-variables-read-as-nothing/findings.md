# AR0471 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A command substitution inside a fallback word is never judged

- Kind: security
- Found by: 2026-10-27-worker-c28e3457 (worker), 2026-10-27
- Where: `packages/core/src/shell-words.ts:93`
- What: the `dollar` branch for `${…}` parses a fallback word (`${x:-word}`, also `=`, `+`, `?`) only for its words and drops the commands of a `$(…)` or a backtick substitution in it, so they never reach `before` and the guard never sees them. A row `["bash", { command: "echo ${x:-$(rm ../../acme/README.md)}" }, MAIN]` in `packages/core/test/worktree-guard.test.ts` fails with `undefined`; bash runs the `rm` when `x` is unset. It was there before AR0471 (`shellWords` dropped them too).
- Suggestion: push the items of the fallback's substitutions (those between a `(` and its `)` in `shellCommands(fallback[1]!, known)`) into `before`, not the fallback's own words, so `echo ${x:-rm a}` stays a word; `shell-words.ts` is at its 200-line cap, so the fix needs a line freed or a split.
- Status: open
