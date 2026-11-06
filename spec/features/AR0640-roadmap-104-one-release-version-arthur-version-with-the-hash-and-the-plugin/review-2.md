# AR0640 - Review 2

- Job: 2026-11-06-review-d9074b29
- Branch: arthur/2026-11-06-worker-3aac4951
- Commit reviewed: 7fd103c7fc1f30ecfff7ede994e2adf59b7021d3
- Verdict: PASS

## Final message

No blocking findings. The branch does what roadmap entry 104 and the AR0640 ticket ask:
- **One release:** version 0.1.0 is in every `package.json` and the lockfile, held by a test.
- **`arthur version`:** it prints `<release> <hash>`.
- **Machine checks:** the spawn and the machines check compare the hash, the last word, and a refusal names both whole lines. A machine that prints the hash only is refused.
- **Plugin range:** a plugin's `peerDependencies["@arthur/core"]` is read at load. Only `^x.y.z`, `~x.y.z` and an exact `x.y.z` are read; any other range is reported as unread. A plugin without the field gives no line. A core outside the range gives one non-critical doctor line, so `printAtStart` does not refuse the start.
- **Version on main:** a `package.json` already counts as code for the merge's check of main, since every non-`.md` file outside `spec/` does (`merge-command.ts:122`). The changed `merge.test.ts` case shows a version changed by hand on main refusing the next merge.

The worker's final message names the core budget raise (7239 → 7285). It waits for the owner (AR-D537) and does not block this review.

## Notes
- (minor) packages/machines/src/machine-check.ts:88: three-word line not tested in the machines check. The spawn tests a line of three words (`x 0.1.0 <hash>`), but the machines rows do not; the regex refuses it either way.
- (minor) packages/delivery/test/merge.test.ts:577: the case that edited `hand.ts` now edits `package.json` instead. A `.ts` file stays covered by the same rule, which treats any non-`.md` file outside `spec/` as code.
- (minor) packages/core/src/cli.ts: 201 lines, yellow, as at the base. The diff changes one line in place and adds none.

## Checks (on 7fd103c7)
- `node --import @arthur/core/testing --test packages/core/test/plugin-range.test.ts packages/machines/test/machines.test.ts`: 23 tests, 23 pass, 0 fail.
- Hand mutation in `machine-check.ts`: comparing the last word instead of requiring two words. `machines.test.ts` failed: the `alone` row, a hash-only line, came out `ok`. Restored.
- Hand mutation in `plugin-range.ts`: `^0.0.z` read like `^0.y.z` (`fixed` 3 → 2). `plugin-range.test.ts` failed with true where false was expected. Restored.
- `git status --short` was empty after restoring both files.
- I did not run `npm run check`, `npm test` or `npm run mutate`; you told me not to rerun the full suite, and the worker ran them on this tip.

PASS