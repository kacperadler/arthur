# AR0498 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. An empty quoted word vanishes, so `git -C '' -C <main>` passes the guard

- Kind: security
- Found by: 2026-10-29-worker-8bf1122a (worker), 2026-10-29
- Where: `packages/core/src/shell-words.ts` (`shellCommands`)
- What: `shellCommands("git -C '' -C ../../acme commit -m x")` gives the words `git -C -C ../../acme commit -m x`: the empty word `''` (and `""`, or `"$v"` with `v` unknown) is dropped, where bash keeps it as an empty argument. The next word then becomes an option's value. A row `["bash", { command: "git -C '' -C ../../acme commit --allow-empty -m x" }, MAIN]`, added to `packages/core/test/worktree-guard.test.ts` for a run of `node --test --test-name-pattern="each call that writes into the main checkout" packages/core/test/worktree-guard.test.ts` and removed after, failed with `undefined`. Real `git -C '' -C packages rev-parse --show-prefix` printed `packages/`, so git takes `-C ''` as a no-op and the commit would land in the main checkout. Other wrappers or options with a value may be open to the same shift (`sudo -u '' …`) [inference, not run].
- Suggestion: keep a quoted empty word in `shellCommands` as an empty word (bash drops only an unquoted expansion that comes out empty), with a row for `git -C ''` and one for an option of a wrapper; leave the unquoted-expansion case as it is.
- Status: open
