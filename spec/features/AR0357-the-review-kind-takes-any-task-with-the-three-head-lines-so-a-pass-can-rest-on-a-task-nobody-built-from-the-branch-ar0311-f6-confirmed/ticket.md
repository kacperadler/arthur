# AR0357 - The review kind takes any task with the three head lines, so a PASS can rest on a task nobody built from the branch (AR0311 F6, confirmed)

```json
{
  "id": "AR0357",
  "title": "The review kind takes any task with the three head lines, so a PASS can rest on a task nobody built from the branch (AR0311 F6, confirmed)",
  "date": "2026-10-23"
}
```

## Description

`arthur spawn --kind review '<task>'` with hand-written `Ticket:`, `Branch:` and `Commit:` lines, from the coordinator or from any job (AR0323), starts a review of any commit the repository holds, while the worker still runs too, with any text under the head lines; a `Commit:` that is the branch's tip and a final line `PASS` is then the PASS `arthur merge` and `--auto` take. In the probe, a spawn naming main's HEAD as `Commit:` was accepted, and one naming the tip whose agent ended on `PASS` let `arthur merge <worker>` in without `--unreviewed`.

## Goal

A review spawn is accepted only for a worker's branch at its real tip, built by Arthur, so a PASS always rests on the code that will merge; tested.

- Kind: risk

Evidence:
- `packages/delivery/src/delivery.ts:109-125` (`refusal`: one ticket on the board in-progress/review/done, `Branch: arthur/\S+`, `Commit: [0-9a-f]{7,40}`, the round; nothing else), `:53-59` (`prepare` checks out whatever `Commit:` names), `packages/delivery/src/merge-command.ts:130-133` and `packages/delivery/src/auto-merge.ts:24-29` (the record's commit and the final line `PASS` are the PASS)
- Found by: 2026-10-23-ar0324-security-check-87836883 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: in `refusal` (or `prepare`), take the task only when it is byte for byte what `reviewTask(host, worker, round)` builds for the worker `Branch:` names: that worker exists, is a worker, has ended, its branch's tip in the project's checkout is `Commit:` (the full sha), and its one ticket is the task's; refuse any other task with `a review's task is what arthur review writes; spawn it with arthur review <worker job>`. The hand-back builds its task with `reviewTask` already, so it passes. Tests in `review.test.ts`: a hand-written task with the real tip refused; one with another commit refused; one while the worker runs refused; `arthur review` and the hand-back's next review still start; an eval's review (`named`, no home) unchanged. Out: who may run `arthur spawn` at all (AR0323).
- `npm test` and `npm run check` pass.

## Scope

In:
- in `refusal` (or `prepare`), take the task only when it is byte for byte what `reviewTask(host, worker, round)` builds for the worker `Branch:` names: that worker exists, is a worker, has ended, its branch's tip in the project's checkout is `Commit:` (the full sha), and its one ticket is the task's; refuse any other task with `a review's task is what arthur review writes; spawn it with arthur review <worker job>`. The hand-back builds its task with `reviewTask` already, so it passes. Tests in `review.test.ts`: a hand-written task with the real tip refused; one with another commit refused; one while the worker runs refused; `arthur review` and the hand-back's next review still start; an eval's review (`named`, no home) unchanged. Out: who may run `arthur spawn` at all (AR0323).

## Decisions

- 2026-10-23: Source: F1 of AR0324
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
