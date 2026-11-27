# AR0752 - Autopilot's default budget is its cap

```json
{
  "id": "AR0752",
  "title": "Autopilot's default budget is its cap",
  "date": "2026-11-27"
}
```

## Description

A pre-approved (autopilot) ticket's worker gets $3 by default instead of $1, the same as the cap, so small fixes stop running out and coming back to the owner as a budget question.

## Goal

Each time an autopilot worker ran out at $1, the owner was asked and picked the $3 cap.

Evidence (retro spec/retro/2026-11-27.md, proposal 3):
- AR-D700: AR0728 "used its pre-approved $1 without a commit"; the owner raised it to $3.
- AR-D718 and AR-D724: AR0736, a one-sentence doc fix, ran out at $1 twice; the owner picked $3 both times; its outcome says $2.16.
- AR0739 F4: `arthur stats budget` prints "fix: 89 tickets, median $2.28", so about every second autopilot fix stops at $1.

It raises no limit the owner has not already granted: the cap stays $3.

- Kind: chore

## Done means

- `arthur ticket status <id> planned --autopilot` on a project whose config sets no autopilot budget prints a budget of $3; a test in `packages/orchestration/test/` asserts it and fails on the current code.
- A configured autopilot budget still wins, and the cap stays $3.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/orchestration/src/autopilot.ts`: `AUTOPILOT_BUDGET = 3` and its comment.
- The autopilot test, and the doc page that names the $1 default if one does.

Out:
- The cap itself.
- Which tickets autopilot may pre-approve.

## Decisions

- 2026-11-27: Source: retro spec/retro/2026-11-27.md
