# AR0689 - Review 1

- Job: 2026-11-11-review-cdacfa7a
- Branch: arthur/2026-11-11-worker-0501072d
- Commit reviewed: 0e443b0e1a3ff0dda199c4be3948190d0ff75e42
- Verdict: PASS

## Final message

I found no blocking problems in `71f92d9f..0e443b0e`. The branch follows the approved `plan.md`:

- **Saving progress:** a run that the 1500 s deadline cuts saves `{ head, base, max, tried, survivors }` to `mutate-resume.json` in the worktree's own Git folder. It writes a temporary file and renames it.
- **Resuming:** the next run with the same commit, merge-base and `--max` starts where the last one stopped. Its summary and exit status count every call.
- **Finished runs:** a run that finishes deletes the file.
- **Bad files:** a file with the wrong key or a broken shape makes the run start over.

The gate, the checks extension, the deadline and the summary format are unchanged.

The test covers every point in Done means:
- A run cut by time can be resumed, and the resumed output matches one uninterrupted run byte for byte.
- A `--max 2` run still ends in `; 14 not run (--max 2)`, so the gate still refuses it.
- A finished run leaves nothing to resume, and the at-limit and start-over rows are there.

Both docs that describe this were updated: item 3 of `verify.md` and "Before a review" in `review-needed.md`. The gate's own refusal text still says "mutate capped at --max", which the plan chose to leave as it is. Nothing in the diff names a client or another project.

## Notes
- (minor) test/mutate.ts:72: a saved `survived:` line is printed verbatim, so a hand-written string containing `\n` could add arbitrary lines to the output. The plan accepts that a job can forge this file, as it can already write false checks lines. The real summary line is still printed last.
- (minor) packages/delivery/src/review-command.ts:136: the refusal for a time-cut run still reads `mutate capped at --max <n>`. The plan leaves this as it is on purpose; it is not a change of this branch.

## Checks run (all at 0e443b0e)
- `npm run check`: tsc passed. `npm test`: 1721 tests, 1657 pass, 0 fail, 0 cancelled, 64 skipped, exit 0. These ran as two calls: in the first call, my `grep` filter matched no summary lines, so I ran `npm test` again on its own.
- `npm run mutate`: `mutate: 25 mutants, 25 caught, 0 survived; 8 not run (--max 25)`, exit 0, 402 s. Afterwards `pgrep -af "arthur-test|limit.test.ts|test/mutate"` found no leftover processes, and there was no `mutate-resume.json` at `git rev-parse --git-path`.
- Four hand mutations of `test/mutate.ts`, each checked with `node --import @arthur/core/testing --test test/mutate.test.ts`. Each was caught, and I restored the file with `git checkout -- test/mutate.ts`:
  - `Number.isInteger(saved.tried)` replaced by `true`: 1 fail.
  - `saved.base === key.base` replaced by `true`: 1 fail.
  - `saved.tried <= size` changed to `<`: 1 fail.
  - The progress path moved off the Git path: 4 fail.
- `git status --short` was empty at the end.

PASS