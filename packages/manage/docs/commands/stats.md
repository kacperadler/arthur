# arthur stats

Usage: `arthur stats [--project <name>]`. Comes with the `manage` plugin (roadmap entry 61). Answered without the model, for one project, the main one unless `--project` names another.

How the merged tickets went: one line per merged ticket, in the order they were made, then six lines over all of them:

```
Stats of acme: 3 merged tickets
AC0001 Shop: 2 rounds (FAIL, PASS), $3.50, 2 days
AC0002 Cart: no review, cost unknown, 0 days
AC0003 Fix the total: 1 round (PASS), $0.40, 1 day, autopilot

Mean review rounds: 1.5 over 2 reviewed tickets
First-round PASS: 1 of 2 (50%) reviewed
Autopilot: 1 of 3 (33%) merged
Most expensive: AC0001 $3.50, AC0003 $0.40; cost unknown for 1 ticket
FAIL findings:
- AC0001 review-1: 1. `src/cart.ts:12` - the total ignores the discount.
```

Where each comes from, all in the ticket's folder in the project's checkout (`spec/features/<id>-<slug>/`):

- Rounds and verdicts: its `review-N.md` files, in the order of N, each the verdict of its `- Verdict:` line, `none` when it is not `PASS` or `FAIL`. A ticket with no review file says `no review`.
- Cost: the `- Cost:` line of its `outcome.md` (`arthur merge --help`), the worker's and the reviews' amounts added. An `outcome.md` that is missing, has no such line, or says `n/a` for either amount (a job's cost file was missing at the merge) is `cost unknown`, never $0: it counts in neither the most expensive nor any sum.
- Days: from the `date` of its `ticket.md`'s JSON block, the day it was made, to the day of its last move on the board, to merged, in `core.timeZone`. Either missing is `days unknown`.
- `autopilot`: its `ticket.md` holds a `- YYYY-MM-DD: Pre-approved by policy:` line (`arthur coordinator --help`, "Autopilot").

Over all merged tickets:

- Mean review rounds: the review files per ticket, over the tickets with at least one; a ticket without reviews is left out, not counted as 0.
- First-round PASS: of the reviewed tickets, those whose `review-1` (the lowest N) is PASS.
- Autopilot: of every merged ticket, those pre-approved by policy.
- Most expensive: the 3 with the highest known cost, highest first, and how many have none known.
- FAIL findings: for each FAIL review, `<id> review-N: ` and the first line of each of its findings. The findings are the section under the first heading of its final message that names `Findings` (`## Findings`, `## Review Findings`, `**Findings**`, `Findings:`), up to the next `#` heading or a bold `Notes` or `Checks`; each finding is a line that opens as the section's first does: a number (`1.`), a bullet (`-`, `*`), or bold (`**`) after a blank line. A section that opens with plain text is one finding; a review with no such heading gives the first line of its final message.

With no merged ticket, one line says so: `No merged ticket in <project> yet.` It reads only: nothing is written. More than nothing after the command prints `usage: arthur stats [--project <name>]` and exits 2; an unknown project exits 1 with the board's refusal.
