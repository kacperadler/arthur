# AR0158 - Review 2

- Job: 2026-10-18-review-ar0158-f1476fa7
- Branch: h/2026-10-18-ar0158-f5a05899
- Commit reviewed: 542d75851be4387e1830ec40a5d9663525168175
- Verdict: PASS

## Final message

The new work fixes the earlier finding: the procedure check now refuses a symlink anywhere on the path, not just on the file itself.

**Findings:** none.

**Notes**
- `procedureText` in `packages/schedule/src/sweep.ts` compares the real path of the procedure file with the path as written, both measured from the real run folder. It refuses a symlinked file, a folder linked to `..`, and a folder linked to `.`. A run folder that is itself reached through a symlink still works.
- The updated procedure test covers all three cases, and also runs with the run folder behind a symlink.
- `packages/schedule/docs/schedule.md` states the whole-path rule and the new refusal message.
- The schedule source is still 277 lines, so the `schedule: 277` budget is unchanged.

**Checks run**
- `npm ci`: ran without printing errors.
- `npm run check` (tsc): no errors.
- `npm test`: 524 tests, 524 passed, 0 failed.
- Mutation: I reverted the check to the old leaf-only `lstatSync(file).isSymbolicLink()`. The schedule tests then ran 10 pass and 1 fail, so the new test catches the old bypass. I restored the file afterwards.
- `git status --short` is clean after the restore.

PASS
