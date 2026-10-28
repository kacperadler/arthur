# AR0484 - Review 1

- Job: 2026-10-29-review-0484756b
- Branch: arthur/2026-10-29-worker-82b42c14
- Commit reviewed: 48c814c0bd84e652697e932fad6cd3be0370e83b
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch does what AR0484 asks: a board entry whose `path` is not `spec/features/<its own id>-<slug>/ticket.md` is now refused, and `spec/build.json` is on the always-review list.

## Findings

None.

## Notes

- `packages/core/src/board-file.ts:76`: every reader in the ticket's Where list (`plan-file.ts`, `review-file.ts`, `ticket-file.ts`, `board-commands.ts`, `autopilot.ts`, `stats.ts`, `changelog.ts`) gets its tickets from `host.board`. That reads the file through `readBoard` → `entryProblem`, the only place that parses the board. So this one check covers all eight in-scope files. `id` goes into the `RegExp` without escaping, which is safe: the `ID` check (`/^([A-Z]+)(\d{4,})$/`) runs first, so `id` is only capitals and digits.
- I tried several ways around the check and none got through: `..` in the slug or after it, an absolute path, `./`, another ticket's id, an id with an extra digit, an empty or uppercase slug, a subfolder, a trailing `/`, a trailing newline (JS `$` without the `m` flag does not match before `\n`), and `plan.md` in place of `ticket.md`. The slugs that `slug()` in `ticket-template.ts:20` writes (non-empty, `[a-z0-9-]`) still pass. Not covered: a ticket folder that a merged branch commits as a symlink. The ticket does not name that case.
- Mutation the tests do not catch: unescaping the `.` in `ticket\\.md`. It only lets a path like `ticketXmd` through, in the ticket's own folder, so it does not reopen the hole.
- `packages/delivery/src/delivery-options.ts` is outside the ticket's Scope list. Done means asks for the always-review change, and the worker's final message says so.
- The worker reports writing a backup to `/tmp/ar0484-board-file.ts.bak` and deleting it. Nothing stays behind, and the committed test uses `temporaryFolder()/outside`, not a fixed path.
- To stop my second test run I used `pkill -f` with a pattern that matches any worktree's `npm test`. Afterwards I saw only unrelated test processes still running.

## Checks run

- **`npm ci`:** exit 0.
- **`npm run check`:** `tsc`, exit 0.
- **`npm test`, first run:** in the foreground, but the harness moved it to the background; it finished with `test=0`, the exit code of `npm test`. Its filtered output showed no failures, and it includes the structure and line-budget tests.
- **`npm test`, second run (output to a file in the worktree):** `tests 1262, pass 1199, fail 0, cancelled 1, skipped 62`. I stopped this run at its end, which probably caused the one cancel. The log is deleted.
- **The three touched test files** (`board.test.ts`, `plans.test.ts`, `review-needed.test.ts`), as the baseline for the mutations below: pass 44, fail 0.
- **Mutations**, each restored with `git checkout --`; the tree is clean afterwards:

| Mutation | Result |
|---|---|
| Old check put back (`path === ""`) | fail 2: the board test and the new plan test. This is the Description's case failing before the fix. |
| Own id replaced by any id | fail 1 |
| Slug `[^/]+` | fail 1 |
| Empty slug allowed (`*`) | fail 1 |
| `$` removed | fail 1 |
| `^` removed | fail 1 |
| `spec/build.json` taken off `ALWAYS_REVIEW` | fail 1 |
| `\.` in `ticket\.md` unescaped | **pass 44, not caught** (see notes) |

PASS