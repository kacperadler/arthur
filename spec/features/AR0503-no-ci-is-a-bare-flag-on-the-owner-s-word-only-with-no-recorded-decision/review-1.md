# AR0503 - Review 1

- Job: 2026-10-27-review-55f2df17
- Branch: arthur/2026-10-27-worker-1a50f0e0
- Commit reviewed: 0506a3421c2e3c14c6f1c24e5bed891e3ed0bd52
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0503 asks: `--no-ci` now needs the owner's recorded decision, `--auto --no-ci` is refused, and all checks pass.

## Findings
None that block the merge.

## Notes
- **F1 is real, and the worker logged it as open** in `spec/features/AR0503-…/findings.md`. `decision.owner` (`packages/orchestration/src/decision-use.ts:27-56`) checks the decision's kind, ticket or job, its state and its use, but never `what`. So a decision the owner answered for `--unreviewed` on `merge <job>` also lets `--no-ci` through on that same merge. That fits the ticket's own design ("as `--unreviewed` is"), so it is not a reason to fail, but the coordinator could still add `--no-ci` on top of a decision the owner gave only for `--unreviewed`.
- **One mutation survived, but in code the range does not change:** at `merge-command.ts:124`, making `--no-ci` also skip the PASS check (adding `&& mode.ci` to the passGap condition) is caught by no test. Nothing checks that `--no-ci --decision` still refuses a branch without a PASS.
- **The worker changed four docs outside the ticket's file list and said why:** `decision.md`, `github.md`, `docs/plugin-api.md`, and the comment in `decision-use.ts`. Each one described the old bare flag, and each now says what the code does.
- **Bypass angles tried, none found:**
  - `--decision --no-ci` is refused with "needs a value".
  - A second `--decision` is refused as an unknown flag.
  - `--auto --no-ci --decision <id>` exits 2.
  - With both flags, each one asks for the decision, the asks go in order and the first refusal stops the merge.
  - With `--no-ci`, CI is never asked, so asking the decision "before CI" has no ordering gap.
- The usage line, the docs and the coordinator role all agree with the code. `merge-command.ts` is at exactly 200 lines.

## Checks run
- `npm ci`, then `npm run check`: tsc reported no errors. The pipeline's exit code 1 came from a trailing `grep` that matched nothing, not from tsc.
- `npm test`: 1223 tests, 1162 pass, 0 fail, 61 skipped. This matches the worker's numbers.
- `merge.test.ts` and `auto-merge.test.ts` alone, on an unmodified copy: 34 tests, 33 pass, 0 fail.
- Mutations, each in a throwaway copy under `/tmp`, removed afterwards; the checkout is clean (`git status` is empty):
  - **`--no-ci` dropped from the `decision.owner` asks:** caught, 1 test failed ("a plain merge asks github.ci …").
  - **The `--auto && --no-ci` usage refusal removed:** caught, 2 tests failed ("--auto CI: …" and "refused before anything …").
  - **`--decision` allowed only with `--unreviewed`:** caught, 2 tests failed ("only a merge puts code on main …" and "a plain merge asks github.ci …").
  - **`--no-ci` also skipping the PASS check (code outside the range):** not caught, 33 pass and 0 fail (see notes).

PASS