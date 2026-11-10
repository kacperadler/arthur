# AR0675 - A worker's run end that gets the checks reminder loses the leftover-processes reminder for the rest of that run

```json
{
  "id": "AR0675",
  "title": "A worker's run end that gets the checks reminder loses the leftover-processes reminder for the rest of that run",
  "date": "2026-11-10",
  "budget": 3
}
```

## Description

A worker whose run ends with both its checks not passed and a process left running gets both reminders, not only the checks one.

## Goal

AR0585's reminder disappears in exactly the runs that end early and untidy. The agent never learns of a background run or server it left behind before it commits again.

Evidence (audit 2026-11-10):
- omp's dispatcher (`strings ~/.local/bin/omp`, the `session_stop` branch) asks every handler but keeps the first continuation: `if (a.continue === true && l) s ??= a;`.
- `packages/core/src/fake-agent.ts:154` does the same (`answers.find`).
- `packages/delivery/src/delivery.ts:117`: the checks extension is registered before the processes extension.
- `packages/delivery/src/checks-extension.ts:48-58`: on a worker run whose checks have not passed on its clean committed tip, it answers `continue`.
- `packages/delivery/src/processes-extension.ts:18-23`: it sets `reminded = true` as soon as it answers, even when its answer is dropped. At the run's next end it answers nothing.
- `packages/delivery/docs/delivery.md:26-28`: says such a run goes on with the processes message. When a worker leaves a process running and ends before its checks pass, it never gets that message. [INFERENCE] the end-to-end case is read from the code above, not from a live omp run.

- Kind: fix

## Done means

- Delivery answers `session_stop` from one handler that joins the checks and the processes reminders, checks first, each still at most once per run.
- A fake-agent test: a worker with a process left and no checks passed gets both texts in one continuation; it fails before the change.
- `packages/delivery/docs/delivery.md` says what the code does; `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Scope

In:
- delivery answers `session_stop` from one handler that joins both reminders, checks first, each still at most once per run. Add a test with the fake agent: a worker that has a process left and no checks gets both texts in one continuation.

Out:
- the reminders' wording and the wrapper's kill at the job's end.

## Decisions
- 2026-11-10: Source: audit spec/quality/2026-11-10.md
- 2026-11-10: Source: F1 of AR0656
- 2026-11-10: Source: F3 of AR0656
- 2026-11-10: AR0675 approved; the owner: "approve all five" (AR-D609)
