# AR0581 - Defaults T13: the fakes of GitHub, YouTrack and Telegram are checked against recorded shapes, and tsc gets stricter

```json
{
  "id": "AR0581",
  "title": "Defaults T13: the fakes of GitHub, YouTrack and Telegram are checked against recorded shapes, and tsc gets stricter",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T13: P18, P20. The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

Committed key lists (`github-shapes.json`, YouTrack's, Telegram's), each with its source URL and date, and one `fake-shapes.test.ts` per plugin comparing the fake's keys recursively. The three `tsconfig.json` flags of the plan's audit (`spec/features/AR0561-.../audit/tooling.md`) and the two fixes (`merge-checks.test.ts:280`, `youtrack.test.ts:859`).

- Kind: test

## Done means

- Each `fake-shapes.test.ts` fails when a key is removed from its fake.
- `npm run check` passes with the three flags.
- The fake line in `.agents/arthur/criteria/review.md` becomes "the shape test passes".
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (none (tests and `tsconfig.json` only)), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/{github,youtrack,telegram}/test/*-shapes.json` (new), `fake-shapes.test.ts` (new) in each, `tsconfig.json`, `packages/delivery/test/merge-checks.test.ts`, `packages/youtrack/test/youtrack.test.ts`, `.agents/arthur/criteria/review.md`.

Out:
- Anything of another of the plan's tickets.

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)
- 2026-10-30: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
