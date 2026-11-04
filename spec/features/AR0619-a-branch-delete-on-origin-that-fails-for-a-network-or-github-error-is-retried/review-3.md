# AR0619 - Review 3

- Job: 2026-11-04-review-78b57628
- Branch: arthur/2026-11-04-worker-05ae6245
- Commit reviewed: 9f48817ae65b5ee09bfe16c8da0bfeacd97408b0
- Verdict: PASS

## Final message

The new commit 9f48817a does what it says: the test now waits for the rewritten record itself, not for the PUT. No findings block the merge.

`packages/discord/test/menu.test.ts:76-85`: the old test waited only until Discord had seen a third PUT. But `setMenu` (`packages/discord/src/menu.ts:27-29`) answers the PUT first and only then writes `commands.json.tmp` and renames it over `commands.json`. Under load the test could stop the plugin and read the file while it still held the hand-broken `{ broken`, which is the failure seen on main. The new `until("the record rewritten", record)` waits until `commands.json` parses as JSON. Two things make that the right state to wait for:
- The broken content never parses.
- The plugin writes the file in one piece (temporary name, then rename), so a reader never sees half a file.

So the first time it parses, it is the rewritten record. The assertion then checks that this record holds the key `${BOT}/${GUILD}`. If the plugin stopped rewriting the record, the wait would time out and the test would fail, so the test still catches that behaviour.

The commit uses the core's `until` and adds no loop of its own and no fixed wait, so the structure test's rules on waits hold. It changes only this test file. The worker's message says why: this test failed the merge check on main under load.

## Notes
- (minor) packages/discord/test/menu.test.ts:76: the `record` reader is a second JSON read next to the plugin's own `recorded()`. A test can't import that unexported function, so this is fine.

## Checks (on 9f48817a)
- `npm run check && npm test` (one call, timeout 1800 s): `tsc` passed with no errors; 1529 tests, 1465 passed, 0 failed, 0 cancelled, 64 skipped. No timing test failed, so I didn't run `limits.test.ts` alone.
- I didn't run `npm run mutate`, to stay within the small budget. The worker reports `--max 4` on this tip: 4 caught, 0 survived. I read the change and reasoned through it instead of running a mutation.

PASS