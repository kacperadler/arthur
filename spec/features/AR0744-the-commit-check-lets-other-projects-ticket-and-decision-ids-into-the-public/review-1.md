# AR0744 - Review 1

- Job: 2026-11-27-review-48aa41e4
- Branch: arthur/2026-11-27-worker-e2c7cb0a
- Commit reviewed: 040f640290f11cf085bfabd6df29b44b81bc5b6c
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0744 and the approved plan ask, and every departure from the plan is explained in the worker's message.

- **Done 1-3:** the check refuses another project's ticket ids (`<P>` plus 4 or more digits) and decision ids (`<P>-D<n>`). It looks in tracked paths, in file lines (named `<path>:<line>`, binary files included) and in commit messages. Each prefix is read when the check runs, from the project's config (`test/other-projects.ts:44-48`) or from `<home>/projects/prefixes` (`:49-50`). Arthur's own `AR` ids and the fixture prefixes pass. Each of these has a test row in the fixture repositories.
- **Done 4, no silent pass (checked by hand):**
  - A prefixes file that exists but can't be read (`chmod 000`): the hook exits 1 on a clean commit and on a commit naming an id. The `readFileSync` at `test/other-projects.ts:38` throws EACCES, so the commit is refused, with a stack trace.
  - A prefixes folder that can't be searched: `existsSync` gives false, and the hook exits 1 with the `its prefix was not learned (...; <file>: missing)` line.
  - Neither case let a commit through. The scratch repository only ever held its first commit.
- **Done 5:** `git grep -l -w -E` with the 4 real prefixes from this job's prefixes file lists 0 files at 040f6402. No commit message in the range holds such an id. A scan of the range's diff and messages for the `projects/` folder names, as written or as a slug, also found 0.
- **F1 (the test reads `/proc/self/environ`, which only Linux has):** the finding is correct and safe to leave open.
  - It affects only the test. The hook in production gets `ARTHUR_JOB` from git's environment through `process.env`.
  - The `/proc` read does matter. With `STARTED` forced to `undefined`, the real-checkout test fails in this job with 3 `its prefix was not learned` lines, because 4 of the 5 configs give EACCES here. So that path is what lets the test learn the prefixes inside a job.
  - On a system without `/proc`, a job's run of that test fails loudly; it never passes silently. Jobs run on Linux.
  - The fix F1 suggests (the test kit exports the `ARTHUR_JOB` it cleared) is the right follow-up. The departure from the plan's "the real-checkout test keeps `process.env`" is explained in the worker's message and in F1.
- The docs (`docs/setup.md:127`, `.githooks/commit-msg:2`) describe the new behaviour. No committed line names a real project.

## Notes
- (risk) test/other-projects.ts:86,88: an underscore or a digit next to an id lets it through. Both `\b` and `git grep -w` count `_` and digits as word characters, so `deploy_WS0150`, `WS-D156_note` and `1WS0150` pass in files and in messages. I confirmed this in a scratch repository: the grep printed nothing and the RegExp gave `false`. The plan chose these boundaries to pass `XWS0150`; a boundary of "not a letter or digit" (`git grep -P`) would catch the underscore forms.
- (minor) test/other-projects.ts:38: an unreadable prefixes file, or one that is a folder, refuses the commit with a raw Node stack trace rather than the `its prefix was not learned` line naming the config and the file. It also refuses when every config gave its prefix. The commit is still refused.

## Checks
All on 040f6402, in this review job.
- `NODE_OPTIONS=--max-old-space-size=2048 node --import @arthur/core/testing --test test/other-projects.test.ts`: tests 7, pass 7, fail 0.
- Mutation by hand: `STARTED = undefined`, then the real-checkout test alone: pass 0, fail 1. Restored with `git checkout -- test/other-projects.test.ts`, and `git status --porcelain` was clean.
- Unreadable prefixes file, as a scratch hook fixture: exit 1 on `docs: clean` and on `fix: for WS0150`. Prefixes folder that can't be searched: exit 1 with the `missing` finding.
- Done 5 grep with the real prefixes at 040f6402: 0 files. Range commit messages: no id. Range diff and messages: 0 real project names.
- Not run, as you asked: the full `npm run check && npm test` and `npm run mutate`. For those this review relies on the worker's figures on this commit: 1982 tests, 0 fail; 97 of 100 mutants caught, 3 survivors recorded as F2.

PASS