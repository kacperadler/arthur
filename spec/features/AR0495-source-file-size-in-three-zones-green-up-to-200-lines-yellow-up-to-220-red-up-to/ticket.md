# AR0495 - Source file size in three zones: green up to 200 lines, yellow up to 220, red up to 250, never above

```json
{
  "id": "AR0495",
  "title": "Source file size in three zones: green up to 200 lines, yellow up to 220, red up to 250, never above",
  "date": "2026-10-27"
}
```

## Description

The owner, 2026-10-27, via Telegram: "IMO we should improve that and 200 is the green limit 200 + 10% is yellow limit but 200 + 25% is red limit and we should not cross that, what do you think about this structure? can we improve the code for that and add maybe a tool that will count and guard that for us?"

Today a source file has a hard cap of 200 lines (`.agents/arthur/criteria/styleguide.md`, "Shape"), held by `test/structure.test.ts` ("a source file of exactly 200 lines passes, 201 lines fails"). That test is already the guard: it runs in every `npm test`, in each merge's checks and in CI. A file at the cap blocks the next small fix in it (AR0469: `merge-checks.ts` at 204 lines after a merge of main, AR-D169, AR-D170).

## Goal

A file may grow a little past 200 lines while a split is planned, but never far, and everyone sees which files are past 200.

- Kind: chore

## Done means

- Zones, in `test/structure.test.ts` and the styleguide's "Shape":
  - green: up to 200 lines; nothing printed.
  - yellow: 201 to 220; the test passes and prints one line per such file (`<path>: 207 lines, yellow (over 200)`).
  - red: 221 to 250; the test passes only for a file named in a list in `test/structure.test.ts` beside `BUDGETS`, one per line with a blank line after it (its reason recorded in the ticket's Decisions, as a budget raise is); an unlisted red file fails, naming the list.
  - above 250: the test fails, whatever the list says.
- The reviewer criteria: a branch that moves a file into yellow or red says why, and a yellow or red file that has an obvious split is a finding.
- `arthur doctor` (or the line the structure test prints) lists the yellow and red files, so the owner and the coordinator see them without reading code. No new command if the test's own lines are enough.
- Tests for each boundary: 200, 201, 220, 221 listed and unlisted, 250, 251 listed.
- The project's checks pass.

## Scope

In:
- `test/structure.test.ts`: the zones and the red list.
- `.agents/arthur/criteria/styleguide.md`: "Shape".
- The reviewer's criteria file that names the 200-line rule.
- `arthur doctor`'s check, if the test's lines do not reach the owner.

Out:
- The package line budgets: they stay as they are.
- Splitting files that are already near 200: their own tickets when they reach yellow.

## Decisions

- 2026-10-27: The owner proposed green, yellow and red zones for a file's lines and a tool that counts and guards them; the coordinator wrote this ticket, left at planning for his approval.
- 2026-10-27: AR0495 approved as written; built after this day run; the owner: "AR-D171 1" (AR-D171)
- 2026-10-31: Merge AR0495 (source file size zones) now; the owner: "Go with recommendations" (AR-D410)
