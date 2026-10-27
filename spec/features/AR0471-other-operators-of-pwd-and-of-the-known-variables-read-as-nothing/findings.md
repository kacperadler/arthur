# AR0471 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A command substitution inside a fallback word is never judged

- Kind: security
- Found by: 2026-10-27-worker-c28e3457 (worker), 2026-10-27
- Where: `packages/core/src/shell-words.ts:93`
- What: the `dollar` branch for `${…}` parses a fallback word (`${x:-word}`, also `=`, `+`, `?`) only for its words and drops the commands of a `$(…)` or a backtick substitution in it, so they never reach `before` and the guard never sees them. A row `["bash", { command: "echo ${x:-$(rm ../../acme/README.md)}" }, MAIN]` in `packages/core/test/worktree-guard.test.ts` fails with `undefined`; bash runs the `rm` when `x` is unset. It was there before AR0471 (`shellWords` dropped them too).
- Suggestion: push the items of the fallback's substitutions (those between a `(` and its `)` in `shellCommands(fallback[1]!, known)`) into `before`, not the fallback's own words, so `echo ${x:-rm a}` stays a word; `shell-words.ts` is at its 200-line cap, so the fix needs a line freed or a split.
- Status: ticket AR0491

## F2. An unquoted `~user` is read as a relative folder named `~user`

- Kind: security
- Found by: 2026-10-27-worker-c28e3457 (worker), 2026-10-27
- Where: `packages/core/src/shell-words.ts:192`
- What: the parser expands only `~`, `~+` and `~-` at a word's start; any other `~` keeps a backslash, so `~acme/arthur/README.md` is judged as a folder `~acme` under the current one. Bash expands `~user` to that user's home from the password database, so with the main checkout at `/home/kacper/arthur`, `rm ~acme/arthur/README.md` writes into it. [INFERENCE] from the code at that line and bash's tilde rules; no guard test exercised it, since a test's main checkout is in a temporary folder no `~user` names. It was there before AR0471, also inside an unquoted `${x:-~user}`.
- Suggestion: refuse an unquoted `~name` at a word's start or after an assignment's `=` as a path the guard cannot tell, or expand it from `os.userInfo()`/the password database for the current user only and refuse others.
- Status: ticket AR0492

## F3. A backslash-newline after `$` is not removed, so `$\<newline>'..'` reads as a folder name

- Kind: security
- Found by: 2026-10-27-review-804fd865 (review), 2026-10-27
- Where: `packages/core/src/shell-words.ts:89`
- What: `rm "${x:-$\<newline>'..'}/../acme/README.md"` (and with `".."`) passes the guard, which reads a folder named `$'..'`; bash 5.2 reads `..` and deletes the main README. The parser never removes a backslash-newline right after `$`, also outside a fallback (`$\<newline>HOME` reads as the text `$HOME`). It passes on the base too.
- Status: ticket AR0493

## F4. `closing()` skips quotes without honouring `\"`, so a command can hide inside a fallback

- Kind: security
- Found by: 2026-10-27-review-804fd865 (review), 2026-10-27
- Where: `packages/core/src/shell-words.ts:39`
- What: `echo "${x:-"\""}"; rm X` hides `rm X` from the guard; bash runs it. On the base too.
- Status: ticket AR0494
