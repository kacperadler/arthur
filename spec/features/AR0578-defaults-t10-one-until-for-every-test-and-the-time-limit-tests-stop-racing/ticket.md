# AR0578 - Defaults T10: one until for every test, and the time-limit tests stop racing

```json
{
  "id": "AR0578",
  "title": "Defaults T10: one until for every test, and the time-limit tests stop racing",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T10: P17. The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

The kit exports one `until(what, predicate, { deadlineMs })`. `structure.test.ts` fails on a test file that declares its own `until` or poll loop, and on fixed waits per file growing past a recorded baseline; the 34 copies are migrated. The `limits.test.ts` time-limit tests respawn at double the limit (3, 6, 12, 24 s) when the job ended before the state they test; build on what AR0565 already changed there. The worker times one full suite under a per-job CPU cap of 3 and reports it; the coordinator then sets `resources({ perJob: { cpu: 3 } })` in the owner's config (AR-D345), and `arthur.config.example.ts` shows it.

- Kind: test

## Done means

- `structure.test.ts` refuses an own `until` and a growing count of fixed waits.
- `limits.test.ts` itself, run under the full suite's load.
- The suite's time at CPU cap 3 in the final message.
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (core/testing +12), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/testing.ts`, `test/structure.test.ts`, `packages/core/test/limits.test.ts`, the 34 test files with their own `until`, `arthur.config.example.ts`.

Out:
- Anything of another of the plan's tickets.

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)
