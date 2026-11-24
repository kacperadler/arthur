# AR0739 - Plan: the coordinator answers from what is true now, silent mode ends on its own, and a job is not stopped by a budget it already spent

```json
{
  "id": "AR0739",
  "title": "Plan: the coordinator answers from what is true now, silent mode ends on its own, and a job is not stopped by a budget it already spent",
  "date": "2026-11-24"
}
```

## Description

On 2026-11-24 the owner asked how the work was going. The coordinator gave him a wrong status. It had also seemed not to react to the harness's events for days. The owner asked for a ticket so that this does not happen again ("I want to fix what was wrong ... create a AR ticket so this will not appear again in the future"). This ticket finds the causes below and fixes them, where possible in code that refuses or ends the wrong state, not only in the coordinator's prompt.

## Goal

The owner hears every event that matters, and every status he is told is true when it is told. No round of his approval is spent on a mistake that a check could have refused.

Evidence, from 2026-11-24:

1. **A status answer not taken from the state.** At about 16:10 the coordinator told the owner that no job was running and that Arthur would restart at any moment. Its own context listed `2026-11-24-review-953209e8` as `working`, and the coordinator had started that review itself at about 15:30. The answer came from its memory of the turn, not from `arthur jobs`. The owner had to ask again before he got the true state.
2. **Silent mode stayed on for six days.**
   - The coordinator turned it on for "the night work" on 2026-11-18. That work's grant ended at 09:00 on 2026-11-24, but silent mode stayed on until the owner complained at about 16:15 that day.
   - All that time, every reply to a job's end, a review, a CI run or a merge was held, not sent: 272 files in `.arthur/orchestration/outbox/held/`.
   - The owner, awake and writing in chat, saw only the replies that carried a decision. To him the coordinator looked deaf to the harness's events.
   - Nothing ends silent mode when its work or grant ends, and nothing reminds the owner or the coordinator that it is still on (`packages/orchestration/docs/commands/silent.md`).
3. **A continue's budget at or below what the job already spent.**
   - `arthur continue 2026-11-22-worker-57bb49ea '...' --budget 30` was accepted for a job whose record held a cost of $49.77. The job ended at once with `limit: budget: its cost $54.6156 reached its budget of $30`.
   - `arthur continue --help` says the cost "counts on from the runs before". The command still accepts the budget, the run starts and spends, and then it stops. The owner was asked a second budget question to fix it.
4. **Budgets too small for the change, each costing the owner a round.**
   - AR0735 at $3 ended at its budget having written nothing.
   - AR0738 at $10 ended with its work uncommitted. At $20 it ended again, and its last message was "Nothing applied; retrying the same edit as the tool says.": a tool loop that spent the rest of its budget.
   - AR0736 at $1 ended with a one-line edit uncommitted.
   - Each needed a budget question to the owner.
5. **Timed retries by hand while CPU was short.** AR0735 (merged 19a44ba4) now tells the coordinator when a machine has room again. This ticket only checks that the coordinator's role and procedures use that message and no longer schedule one-off retry entries.

- Kind: fix
- Plan: yes

The plan settles, with the owner:
- for 1, whether the fix is code, for example the reply's status lines built from the job records rather than written by the model, or the coordinator's role and an eval that holds it;
- for 2, what ends silent mode on its own: the end of its grant, the end of quiet hours for night work, a time limit given at `on`, or a reminder line in each reply while it is on;
- for 3, whether `continue --budget` refuses a budget at or below the job's cost, or reads it as the amount added on top;
- for 4, how a worker's budget is picked so that it fits the change (from the ticket's Scope, or from the cost of past tickets of the same kind), and whether a run that repeats the same failed tool call is stopped before it spends its budget.

## Done means

- A plan (`plan.md`) the owner approves, with one task per cause above, its files and its tests.
- After the build:
  - each cause has a test that fails on today's code and passes after;
  - a continue whose `--budget` would stop the job at once is refused, with a message that names the job's cost;
  - silent mode no longer stays on past its work without the owner being told;
  - the coordinator's status answers are taken from the jobs' records of that turn.
- `npm run check && npm test && npm run mutate` pass.

## Scope

In:
- Set by the plan: `packages/orchestration/` (the silent mode, the coordinator's role and its procedures), the core's `continue` command and its doc, and the evals that hold the role.

Out:
- AR0726: the words an owner's budget decision needs to lift an autopilot cap.
- How a project agent replies, beyond what the silent mode shares with it.

## Decisions

- 2026-11-24: The owner asked for this ticket after a wrong status answer and days of held replies ("I want to fix what was wrong, you tell me now i'm right on both counts so create a AR ticket so this will not appear again in the future").
