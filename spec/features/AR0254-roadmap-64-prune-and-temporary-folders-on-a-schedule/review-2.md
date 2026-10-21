# AR0254 - Review 2

- Job: 2026-10-21-review-ar0254-roadmap-64-f051c120
- Branch: h/2026-10-21-ar0254-roadmap-64-prune-bd13280b
- Commit reviewed: 9ceff445fd433092ac5afce25fa8561c3bb18455
- Verdict: PASS

## Final message

The follow-up fixes the earlier finding. `load()` in `packages/manage/test/cleanup.test.ts` now points `TMPDIR` at a test-owned folder and restores it afterwards, so no cleanup run touches the system `/tmp`.

## Findings

None blocking.

## Notes

- **One failed run:** the first full `npm test` I ran gave 887 passed and 1 failed, and I did not capture which test failed. A second full run passed 888 of 888, and `cleanup.test.ts` passed 7 of 7 on five repeated runs. I did not track down the failure.
- **Restore order, unchecked:** `load()` is called twice in the first test, and each call saves the `TMPDIR` it finds. If the cleanup hooks run in registration order, `TMPDIR` could stay pointed at the first temp folder after that test. It never reaches the real `/tmp`, and I did not confirm the order.
- **Earlier review:** the rest of the range is covered by it. The new work is test-only: 8 insertions and 7 deletions in `cleanup.test.ts`.

## Checks run

- **Real `/tmp` sentinel, targeted test:** I made `/tmp/arthur-rev-sentinel-ar64` dated 3 days ago, with `TMPDIR` untouched, and ran `cleanup.test.ts`. The sentinel survived, which was the earlier failing case.
- **Real `/tmp` sentinel, full suite:** same setup, with `npm test` as the run. The sentinel survived again. I removed it afterwards.
- **Mutation:** I commented out the `TMPDIR` redirect in `load()` and pointed an outer `TMPDIR` at a scratch folder holding an old `arthur-sent` folder. The test file went to 6 passed and 1 failed. The scratch folder was empty afterwards, so the sweep had deleted it. I reverted with `git checkout --`, and `git status` is clean.
- **`npm run check`:** clean.
- **`npm test`, unmodified:** the first run had 887 passed and 1 failed (see Notes). The second run had 888 passed and 0 failed. The worker's claim of 888 of 888 reproduces.
- **`npm ci`:** ran silently before the first test run, and `npm test` then ran, so install did not fail.

PASS
