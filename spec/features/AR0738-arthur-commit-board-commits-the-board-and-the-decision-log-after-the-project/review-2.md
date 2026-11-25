# AR0738 - Review 2

- Job: 2026-11-25-review-218df84d
- Branch: arthur/2026-11-25-worker-c951ebce
- Commit reviewed: 9025fdc540a7cf929da53ccc1560348fbfcc1c09
- Verdict: PASS

## Final message

I found nothing that blocks the merge of `9025fdc5`. The diff does what AR0738 asks: every Done means point is met and has a test. Finding 1 of review 1 is fixed. Under that finding, code below a folder named like a board file got committed, for example `spec/schedule.json/evil_spec.rb`. Now `packages/delivery/src/commit-board.ts:64-66` keeps only an entry whose path is one of the commit's paths, or one a glob matches whole. A changed path that is a folder or a symlink stops the commit.

- **Done means:**
  - **Only board paths:** tested by "commit-board commits every changed board file…" and "a folder named as a board file is none…".
  - **What stops the commit:** a symlink, a `checkConfig` refusal and a refusing `commit-msg` each have their own test.
  - **`arthur init`:** its files are committed (`packages/projects/test/init.test.ts` and `test/init-commit.test.ts`).
  - **Roles and procedures:** they name `arthur commit-board`, `packages/orchestration/roles/project.md:26` included.
  - **Board paths:** they include `spec/schedule.json`, the quality, retro and pyramid `.md` reports, and the retro and pyramid `.html` pages.
- **Plan T2:** the files and approach match. The extra paths, `CHANGELOG.md` and `spec/pyramid/`, are explained in the doc page and the code comment.
- **Ways around the board-only rule:**
  - **A literal file name that works as a wildcard pattern.** I made a new file literally named `spec/quality/*.md` and changed a tracked `spec/quality/old/x.md`. `git commit -- 'spec/quality/*.md'` committed only the literal file; the tracked one stayed ` M`.
  - **Glob characters.** The glob's regex escapes every special character, so it can only narrow what `git status` lists, never widen it.
  - **A nested repository, a folder replacing a board file, a deleted file.** The existing tests cover each one.
- **The worker's claims match what I saw:** test counts, mutate counts, tip and files. The `packages/delivery` line budget (2473) was not raised again after the merge commit.

## Notes
- (minor) `test/structure.test.ts:20`: delivery's budget rises by 103 lines, from 2370 to 2473, where AR0667's plan estimated about +60. The plan allows budget raises; the outcome should state this number.

## Checks run (tip `9025fdc5`)
- **`npm run check`:** tsc finished with no errors.
- **`npm test`:** exit 0; 1948 tests, 1884 pass, 0 fail, 64 skipped.
  - I ran the suite twice. The first run (in the same call as `npm run check`) went through a filter that dropped the summary lines; the second run gave these counts.
  - The structure test prints only files already yellow; none of them is in this range.
- **`npm run mutate`:** 100 mutants, 100 caught, 0 survived; 38 not run (`--max 100`).
- **Hand mutations** of `packages/delivery/src/commit-board.ts`, each run against `packages/delivery/test/commit-board.test.ts`, each restored with `git checkout --` (`git status --short` empty afterwards):
  - Removing the glob regex's `$` anchor failed 2 tests: the folder test and the `delivery.commit` glob test.
  - Changing `isFile() === false` to `isDirectory()` (symlinks no longer refused) failed 1 test: the symlink test.
- **Throwaway Git run** in a temporary folder, removed afterwards: the literal-name case above. Only `spec/quality/*.md` was committed.

PASS