# AR0507 - Review 1

- Job: 2026-11-02-review-1d90e6b9
- Branch: arthur/2026-11-02-worker-00504996
- Commit reviewed: 427d0f05293a6d1f9fd70e9deecab8e02bd4bf27
- Verdict: PASS

## Final message

No findings block the merge. The branch meets every "Done means" point of AR0507.

- **Diff command:** `reviewTask` in `packages/delivery/src/review-command.ts:85` now names `git diff --text --no-ext-diff --no-textconv ${range}`. `git log --oneline` and the ticket's `git show` are unchanged. No doc, role or roadmap still names the old `git diff <base>..` / `git diff ${base}..` form.
- **Reviewer role:** `packages/delivery/roles/reviewer.md:17` says a file the diff still shows as `Binary files ... differ` is read on disk, and a file not read that way fails the review.
- **Test:** `packages/delivery/test/review.test.ts:327` takes the command from the built task and runs it in the tip's checkout. It covers four cases: `*.ts -diff`, `*.ts binary`, a textconv driver and an external diff driver. Each must show `+++ b/<job>.ts` and the changed line. When I removed `--no-ext-diff` by hand, the test failed (`pass 0, fail 1`).
- **Scope:** `GIT_NO_REPLACE_OBJECTS` is left out, as the ticket's Out says (AR0500). The doc change in `docs/commands/review.md` is outside the ticket's In list, but the worker's message names it, and it keeps the command's doc page true.
- **Size:** neither changed source file reached yellow, and the delivery package passes its line-budget test.

## Notes
- (minor) packages/delivery/src/review-command.ts:80: an odd tuple destructure. `const [gap, range] = [untested(...), \`${base}..${commit}\`]` puts two unrelated values on one line, apparently to keep the line count down. Two `const`s would be plainer.

## Checks
- `npm run check && npm test`, one call, timeout 1800: `tsc` passed. My filter dropped the test summary, so I ran `npm test` again with the right filter: tests 1493, pass 1429, fail 0, cancelled 0, skipped 64. This matches the worker's numbers.
- Hand mutation, `--no-ext-diff` removed: `node --test --test-name-pattern=gitattributes packages/delivery/test/review.test.ts` gave pass 0, fail 1. I restored the file with `git checkout --`, and the tree is clean.
- I did not run `npm run mutate`, to keep within the small budget. The worker reports 5 mutants, 5 caught.

PASS