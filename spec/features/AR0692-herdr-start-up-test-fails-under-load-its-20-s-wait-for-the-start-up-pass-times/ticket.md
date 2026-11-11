# AR0692 - herdr start-up test fails under load: its 20 s wait for the start-up pass times out in a full npm test, and blocks reviews of unrelated branches

```json
{
  "id": "AR0692",
  "title": "herdr start-up test fails under load: its 20 s wait for the start-up pass times out in a full npm test, and blocks reviews of unrelated branches",
  "date": "2026-11-11"
}
```

## Description

Two herdr tests fail in a full `npm test` while the machine is loaded, though the branch under test does not touch herdr, so the review gate refuses unrelated branches until someone reruns the suite on a quiet machine. The tests should assert the plugin's start-up pass, not the machine's load.

## Goal

Evidence, from finding F2 of AR0647 (worker 2026-11-11-worker-5f2781a0) and the AR0691 worker's final message, both 2026-11-11:
- `packages/herdr/test/herdr.test.ts:137` "before start nothing reaches herdr; start opens a tab for each job in a run…" fails with `waited 20 s for the start-up pass` (line 152) in 4 of 5 full `npm test` runs on the AR0647 branch and 3 runs on the AR0691 branch, with a load average of 8 to 37.
- `herdr.test.ts:164` "a prune in a process that never started…" then fails at line 169, because herdr calls left over from the test before land in its fake herdr.
- Alone (`node --import @arthur/core/testing --test packages/herdr/test/herdr.test.ts`) the file passes 11 of 11; in the full suite its tests take 5 to 7 times as long (22.2 s against 2.7 s).
- Each herdr call has a 5 s limit (`packages/herdr/src/herdr-cli.ts:9`); under load the fake herdr's start can exceed it, so the start-up pass gives up and the wait never ends.

The fix is the worker's to find and justify from a measurement: for example the test gives the plugin a longer per-call limit (the production limit stays 5 s), or the fake herdr starts faster, or the first test's calls are awaited before the second test begins.

- Kind: test

## Done means

- Under load the two tests pass: with a CPU load made on purpose (for example `node -e 'for(;;){}'` started once per core beside it), `node --import @arthur/core/testing --test packages/herdr/test/herdr.test.ts` passes 11 of 11 in 5 runs out of 5. The final message gives the before and after count of passing runs under that load.
- No test of the file loses an assertion, and the production limit in `herdr-cli.ts` is unchanged.
- `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the tip.

## Scope

In:
- `packages/herdr/test/herdr.test.ts`: how the two tests wait and what limit they give the plugin.
- `packages/herdr/src/herdr-cli.ts` or `packages/herdr/src/herdr.ts`: only if the limit must become a parameter the test can set; the default stays 5 s.

Out:
- Making the whole suite faster: AR0671.

## Decisions

- 2026-11-11: Source: F2 of AR0647
