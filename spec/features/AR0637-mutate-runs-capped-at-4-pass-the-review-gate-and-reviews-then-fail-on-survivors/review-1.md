# AR0637 - Review 1

- Job: 2026-11-07-review-3e9fe2ba
- Branch: arthur/2026-11-07-worker-d163462d
- Commit reviewed: 95311b0ac7b6ff05a39b041d6cfdcff3c07194a0
- Verdict: PASS

## Final message

## Findings

No blocking findings. I checked every Done means point against the diff:

- **Mutate's counts are recorded.** `packages/delivery/src/checks-extension.ts:77,80` writes `mutate pass|fail <run> run, <survived> survived, <not run> not run`. The counts come from the last summary; when the summary has no `; N not run` part, it writes `0 not run`. A run with no summary is still plain `mutate fail`.
- **The gate refuses capped runs.** `packages/delivery/src/review-command.ts:132-136` refuses a run below `min(25, run + not run)` and a line without counts. The refusal names the cap and the counts (`mutate capped at --max 4 (4 run, 0 survived, 12 not run of 16; it counts at 16)`). `run + unrun` equals mutate's total, because mutate prints `mutants.length - max` as the not-run count.
- **Mutants are taken round-robin.** `test/mutate.ts:54-63,75-77` interleaves first over the changed files, then over each file's hunks, each hunk's revert first. A capped run reaches every changed file once `max ≥ files`. `interleave([])` gives `[]`, since an array length of `-Infinity` becomes 0.
- **Tests.** `review.test.ts:928-931` covers the 4-of-16 refusal, the 24-of-25 boundary and the two lines without counts. It also accepts a 3-of-3 run, 26 of 100, and 0 of 0. `mutate.test.ts` "a capped run takes its mutants round-robin…" checks the order across two files and two hunks.
- **Docs.** `review-needed.md`, `review.md` and `verify.md` match the new line format, the gate and the order. No old wording (`mutate ran)`, "runs the first `<n>`") is left in docs, roles or the README.

## Notes
- (risk) packages/delivery/src/checks-extension.ts:77: the counts are read from the call's output text. I worked this out from the regex and did not run it. `npm run mutate -- --max 4 | sed 's/;.*//'` would cut the `; 12 not run` part, so the line becomes `mutate pass 4 run, 0 survived, 0 not run` and the gate takes it. A summary printed with `echo` would also be counted. This is the same output-trust gap as AR0579 F1.
- (minor) packages/delivery/src/review-command.ts:132: `tipChecks` uses the last line on the tip. A later capped run on the same clean tip therefore hides an earlier full run, and the gate refuses. This errs on the safe side.
- (minor) test/mutate.ts: the file grows from 200 to 211 lines. AR0579's ticket set it at "at most 200 lines". `test/structure.test.ts` only sizes files under `packages/*/src`, so no zone rule applies, and the worker's "no file moved into yellow" is true by that definition.
- (minor) packages/delivery/src/review-command.ts:134: `mutate` lines that an older Arthur wrote are now refused as `without its counts`. `review-needed.md` documents this, and the worker said so.

## Checks
On 95311b0a. Following your instruction, I did not rerun `npm run check`, `npm test` or `npm run mutate`. I made each hand mutation with `sed`, ran its test file, then restored it with `git checkout --`. `git status --porcelain` was empty afterwards.

| Mutation | Test file | Result |
|---|---|---|
| Gate always accepts (`run >= need` → `true`) | `review.test.ts` | 27 tests, 1 fail: the review-gate test |
| `Math.min(25, …)` → `Math.min(24, …)` | `review.test.ts` | 27 tests, 1 fail: the same test |
| Default `not run` `"0"` → `"1"` | `checks.test.ts` | 15 tests, 3 fail |
| Both `interleave` calls replaced by `flat()` (the old order) | `mutate.test.ts`, round-robin test | 1 test, 1 fail |
| Inner, per-hunk `interleave` only replaced by `flat()` | `mutate.test.ts`, round-robin test | 1 test, 1 fail |
| None: round-robin test unmutated | `mutate.test.ts` | 1 pass, 0 fail |

PASS