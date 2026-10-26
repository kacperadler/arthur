# AR0448 - packages/core/test/machine.test.ts:719 fails now and then on GitHub CI: a job no longer held is copied again (18 !== 16)

```json
{
  "id": "AR0448",
  "title": "packages/core/test/machine.test.ts:719 fails now and then on GitHub CI: a job no longer held is copied again (18 !== 16)",
  "date": "2026-10-26"
}
```

## Description

One core test fails now and then on GitHub's runner, never seen on the VPS. Each failure turns CI red, and a red run on a branch refuses its plain merge and every `--auto` merge, so it costs the owner a rerun or a decision each time.

## Goal

Evidence: `packages/core/test/machine.test.ts:719` "a plugin's hold on a job there stands at each copy while it runs there and through an offline spell, and ends with its run" failed with `AssertionError: a job no longer held nor in a run is not copied again`, `18 !== 16` (at :748), in run 40310796495 attempt 1 on main 4b392fa (2026-10-26; attempt 2 passed) and in run 40326717741 on arthur/2026-10-26-worker-a0a21ea4 at 4647dc1 (2026-10-26). Find whether the test counts copies before the sweep it waits for has settled (a test race, as AR0423 was) or the job runner copies a job again after its hold and run ended (a bug), and fix the cause.

- Kind: test

## Done means

- The cause is named with its evidence, and reproduced (e.g. a pause or slowed sweep) before the fix: the test fails with `18 !== 16`.
- With the fix and the same reproduction, the test passes; if the cause is in the code, a test that fails without the code fix.
- `npm run check` and the test file pass.

## Scope

In:
- `packages/core/test/machine.test.ts`: the test at :719.
- `packages/core/src/` job runner's copy (machine sync) only if the cause is there.

Out:
- Any other test or behaviour.

## Decisions

