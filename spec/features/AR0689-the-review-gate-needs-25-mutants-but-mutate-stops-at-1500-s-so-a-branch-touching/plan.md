# AR0689 - Plan

- Job: 2026-11-11-plan-4649c1ee
- Planned at: 7ed47b7f696a9de4f88e0052f81024ff275fa582

## Approach
Only `npm run mutate` changes. A run that its 1500 s deadline cut now picks up where it stopped the next time it runs on the same commit, and its summary adds up both runs. AR0671's branch therefore gets `24 run … 1 not run (time)` from the first call. A second `npm run mutate` on the same commit runs the 25th mutant and prints `mutate: 25 mutants, 24 caught, 1 survived`, the same as one uninterrupted run. The review gate accepts that line as it stands.

What changes, in `test/mutate.ts`:
- **Saved progress.** When a run ends with mutants still `not run (time)`, mutate saves how far it got: the count of mutants tried and the `survived:` lines so far.
- **Where and how it is saved.** The file is `mutate-resume.json` at `git rev-parse --git-path mutate-resume.json`. That is the worktree's own Git folder, for example `.git/worktrees/<job>/`. It is outside the tree, so `git status` stays clean and the checks extension still marks the line `clean`. The write goes to a temporary name and is then renamed.
- **The key.** The saved progress belongs to the commit (`HEAD`), the merge-base and `max`.
- **Resuming.** The next run checks the key. If it matches, it prints the saved `survived:` lines first, then runs `run.slice(tried)`. The summary and the exit status count both calls together.
- **Starting over.** mutate starts over and ignores the file when the commit, the merge-base or `--max` differs, or when the file is broken or edited by hand (not JSON, wrong field types, `tried` outside `0..run.length`, more survivors than `tried`).
- **Finished runs.** A run with no `not run (time)` left deletes the file, so the next run starts fresh. Nothing is cached once a run finishes.

Why `--max` below 25 still blocks: the key includes `max`, so resumed runs at `--max 4` add up to 4 at most. Their summary keeps `; N not run (--max 4)`, and the gate refuses that line as it does today.

What is left alone:
- The checks extension (`packages/delivery/src/checks-extension.ts`) and its line format.
- The gate (`untested` in `packages/delivery/src/review-command.ts`).
- The deadline (`1_500_000`) and the 1800 s call timeout.
- The summary line's format.

What the gate proves stays the same: min(25, all) mutants run on the same clean commit, now possibly over several calls.

Options I rejected:
- **The gate counts a time-cut run whose mutants were all caught.** That weakens what the gate proves: a run cut after 1 mutant would pass. It also needs a new line format plus changes to the extension, the gate and three test files. And it would not unblock AR0671, which has a survivor.
- **A longer deadline (3300 s, with the timeout raised to 3600).** A branch whose 25 mutants need more than that would still be blocked forever.

## Not available directly
- none

## Files
- `test/mutate.ts`:
  - Read the saved progress, about line 64, after `const run = mutants.slice(0, max)`. Get the path with the existing `git` helper (`rev-parse --git-path mutate-resume.json`, made absolute with `resolve(root, …)`) and `HEAD` with `rev-parse HEAD`.
  - Print the saved survivors, then loop over `run.slice(tried)`, adding new survivors to the list.
  - After the summary: if `late > 0`, write `{ head, base, max, tried, survivors }` to a temporary file and `renameSync` it into place; else `rmSync(path, { force: true })`.
  - Add `renameSync` and `rmSync` to the `node:fs` import.
  - The header comment (lines 6-11) and the deadline comment (lines 65-66) say that a time-cut run goes on when run again on the same commit and cap.
  - The summary line format does not change.
- `test/mutate.test.ts`: one new test, described under How to test. The existing tests stay as they are. I walked through each one: every repeated run in them either uses a different `--max`, resumes from `tried 0`, or follows a run that finished.
- `.agents/arthur/criteria/verify.md` item 3: add that a run cut by time (`not run (time)`) goes on where it stopped when `npm run mutate` is run again on the same commit with the same `--max`. Rerun until no `not run (time)` is left; the last summary counts every call.
- `packages/delivery/docs/commands/review-needed.md`, "Before a review": one sentence. A run the deadline cut counts once `npm run mutate` has been run again on the same commit and its last summary adds up every call.
- `CHANGELOG.md` is not edited: `arthur merge` rebuilds it (`packages/delivery/src/changelog.ts`, `merge-outcome.ts:80`).

## Risks
- **Stale progress counted for other code.** The key includes `HEAD` and the merge-base, and mutate already refuses a tree with uncommitted changes to tracked files (`test/mutate.ts:49`). So the same key means the same code and the same mutant list: `interleave` over `git diff base HEAD` is deterministic.
- **A job forges the file.** Its trust is the same as the checks lines a job can already write (`review-needed.md` line 39: "no proof against a job that writes false ones"). Mutate still checks the file's shape, so a broken file starts over and does not crash.
- **mutate cannot write the file inside a job's sandbox.** The job sandbox can write to `<common>/worktrees/<job id>` (`packages/core/src/job-sandbox.ts:73`). The job's `index` and `HEAD` live in the same folder, so committing needs the same write access. I checked here that `--git-path` points into that folder: `/home/kacper/arthur/.git/worktrees/2026-11-11-plan-4649c1ee/mutate-resume.json`. The write comes after the summary, with no try/catch: a failing write shows up instead of being hidden. Only jobs run mutate; nothing in `packages/delivery/src` or `packages/core/src` runs it in the step sandbox.
- **A call killed by SIGINT or SIGKILL loses that call's progress,** because the file is written at the end. Only time is lost, not work. The 1500 s deadline makes a normal end before 1800 s the usual case.
- **Reviewer and worker clash.** Each job's worktree has its own Git folder, so their progress files never mix.
- **The gate's refusal text** still reads `mutate capped at --max 24 (…)` for a time-cut line, because the line cannot tell the two cases apart. It is left as is: the hand-back and reminder texts already say "run npm run mutate", and that now resumes. Plain `npm run mutate` and `-- --max 25` share the same key.

## How to test
- **A branch like AR0671's reaches the gate.** New test in `test/mutate.test.ts`, using the deadline test's repository with `first.ts` (16 mutants). It reuses `late()` and `mutate()`:
  1. `late(root, [0, 1_499_999, 1_500_000])` should print `survived: first.ts:1: hunk reverted to the base\nmutate: 1 mutants, 0 caught, 1 survived; 15 not run (time)\n`, exit 1.
  2. `late(root, [0, 1_500_000])` should print the same summary: the total survives a call that ran nothing.
  3. `mutate(root)` should equal, byte for byte, the output of an uninterrupted `mutate(root)` run afterwards: `mutate: 16 mutants, …` with no `not run`. The gate already accepts that line (`packages/delivery/test/review.test.ts:966`), so a time-cut run no longer blocks forever.
  4. After that finished run, `late(root, [0, 1_500_000])` should print `mutate: 0 mutants, 0 caught, 0 survived; 16 not run (time)\n`: a run that finished leaves nothing to resume.
- **`--max` below 25 still blocks.** In the same test:
  1. Cut a `--max 2` run after 1 mutant, then run `mutate(root, "--max", "2")`. It should print `…mutate: 2 mutants, 1 caught, 1 survived; 14 not run (--max 2)\n`: the cap's count stays, and the gate refuses it (`review.test.ts:957`).
  2. A cut default run followed by a `--max 2` run starts over, at 0 mutants.
- **Start-over rows.** Each case follows a run cut after 1 mutant and then expects a run cut at the start to show `0 mutants`:
  - `git commit --allow-empty`
  - the file at `git rev-parse --git-path mutate-resume.json` overwritten with `{`
  - that file holding `tried` beyond the run
- **Clean tree.** After each run, `git status --porcelain --untracked-files=no` is empty and `limit.ts` holds `LIMIT`.
- **The project's checks pass.** Run `npm run check` and `npm test` in one bash call with `timeout` 1800. Then run `npm run mutate` on the committed tip in a call of its own. Baseline today: `node --import @arthur/core/testing --test test/mutate.test.ts` gave 9 of 9 passing in 10.5 s.

## Open questions
- none