# AR0579 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A mutate line stays clean when another command of its call changes a file and puts it back

- Kind: risk
- Found by: 2026-10-31-worker-b935bce1 (worker), 2026-10-31
- Where: `packages/delivery/src/checks-extension.ts:37`
- What: `npm run mutate` writes each mutant over a source file and writes the file's bytes back, which changes the file's ctime, so a `mutate` line cannot be judged by the per-file inode, size and times that `check` and `test` lines are. It is `clean` when the call began and ended on the same clean commit. So `cp other.ts src/a.ts && npm run mutate && git checkout -- src/a.ts` records `mutate pass <tip> clean` for a run on other code. T12 (AR0561's plan, P16) only requires that a `mutate` record exists, survivors allowed, so the gain from such a call is small; `check` and `test` lines of the same call stay `dirty`.
- Suggestion: have `test/mutate.ts` print the tree it ran on (`git rev-parse HEAD^{tree}` and a hash of the tracked files' bytes, read before the first mutant and after the last) in its summary, and let the extension compare that with the call's own readings. Out: any change to how `check` and `test` lines are judged.
- Status: deferred (client summary)

## F2. with the default `--max 25`, it runs only the first mutants in file order, and "hunk reverted" mutants come first

- Kind: fix
- Found by: 2026-10-31-review-df0c53f4 (review), 2026-10-31
- Where: `test/mutate.ts:51-56`
- What: On this branch a default run tries 25 of 608 mutants. A reviewer who "starts from mutate's survivors" sees only a slice of the change. The summary does say how many were not run.
- Status: deferred (client summary)

## F3. a `mutate` line is judged `clean` by commit and status only

- Kind: fix
- Found by: 2026-10-31-review-df0c53f4 (review), 2026-10-31
- Where: `packages/delivery/src/checks-extension.ts:37`
- What: It stays `clean` when another command in the same call changes a file and puts it back. The worker already filed this as F1.
- Status: deferred (client summary)
