# AR0616 - Review 2

- Job: 2026-11-04-review-991ae53c
- Branch: arthur/2026-11-04-worker-6a0f19cc
- Commit reviewed: b902e845920e5e7c11d6d6500504af5cee5ab49e
- Verdict: PASS

## Final message

No blocking findings. The merge of main (`b902e845`) is clean, and the `docs/deploy.md` paragraph keeps both texts. As you asked, I judged the merge and the docs paragraph, not the guard change, which review fac0508e already judged at `420a25d1`.

- **Paragraph under `refs/replace` in `docs/deploy.md:44`:** I compared the line character by character. From main's version (`a1516e81`, AR0615) to the merge, the only change is one inserted sentence, so main's text is kept word for word. The sentence is the branch's text: "It refuses `git fast-import` too, whose refs come on stdin as `git update-ref --stdin`'s do, run on that repository from the job's worktree, by `-C` or by `--git-dir`; on a repository outside every project it runs, but writes the file its `--export-marks` names only where any write may go". It sits right after the fetch `--stdin` sentence, as the worker said. The rest of the branch's old wording ("Not covered…" / "still writes…") was replaced by main's newer AR0615 text, so nothing contradicts the merged code.
- **`packages/core/src/git-writes.ts`:** from the branch tip `420a25d1` to the merge, only main's comment above `intoReplace` changed, to the AR0615 wording about `core.useReplaceRefs=false`. The branch's edits are all still there: `fast-import` in `WRITES_OPERANDS`, `writesRef` counting `fast-import`, and the header comment.
- **The merge's other files** (CHANGELOG, `git-config.ts` and its test, spec files, `test/structure.test.ts`) are main's own changes and come in unchanged.
- **The worker's account** matches what I see: one conflict, in `docs/deploy.md`, resolved by keeping both texts, and the four commits it lists.

## Notes
- (minor) `packages/core/src/bash-refusal.ts`: 208 lines, yellow. The structure test prints it, and the worker says it was yellow before this branch; I did not check that against the base.
- (risk) `spec/features/AR0616-…/findings.md`: F1 is still open: `npm run mutate` leaves `sleep 300` processes running after it ends. It is filed by the branch and is outside this range's code.

## Checks (on `b902e845`)
- `npm run check && npm test`, one call with a 1800 s timeout: tsc passed. That call's grep did not match the test runner's summary lines, so I got no test counts from it.
- `npm test` again, on its own, with a 1800 s timeout: 1536 tests, 1472 pass, 0 fail, 64 skipped. No timing test failed, so I did not need to run `limits.test.ts` alone.
- `node --test test/structure.test.ts`: 20 pass, 0 fail.
- I did not run `npm run mutate`, because the guard change was already reviewed and the budget was small.
- I made no edits to restore, and no process I started is still running.

PASS