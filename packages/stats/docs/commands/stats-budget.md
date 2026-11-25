# arthur stats budget

Usage: `arthur stats budget [--project <name>]`. Comes with the `stats` plugin (AR0739). Answered without the model, for one project, the main one unless `--project` names another; it runs inside a job too.

What the workers of a project's merged tickets cost, per kind of ticket, so a worker's budget is picked from what such a ticket cost before, not guessed: a budget at or under the median stops about every second worker of that kind before it is done, and each stop costs the owner a budget question.

```
Worker cost of the merged tickets of acme, by kind:
feat: 12 tickets, median $5.82, 9 in 10 within $13.62
fix: 7 tickets, median $2.28, 9 in 10 within $9.69
docs: 1 ticket, median $1.53, 9 in 10 within $1.53
Left out: 2 tickets whose outcome.md names no worker cost
```

- One line per kind, the kind with the most tickets first, kinds with as many in name order. The kind is the one word of the `- Kind:` line under the ticket's `## Goal` (`arthur ticket --help`); a ticket without one, or whose line holds more than a word, counts under `no kind`.
- The cost is the worker's alone, the first amount of the `- Cost:` line of the ticket's `outcome.md` (`arthur merge --help`), every run of the worker together; the reviews' amount is not part of it, as a review has its own budget.
- `median` and `9 in 10 within` are each the cost of one of those tickets, by the nearest rank: with the costs in order, the one at half of them and the one at nine tenths of them, rounded up. Of 10 tickets they are the fifth and the ninth; of 11, the sixth and the tenth; of one, that ticket's cost twice.
- The coordinator's role takes the `9 in 10 within` figure of the ticket's kind as a worker's budget, in the approval question and at the spawn, and names it with this command as its source.
- A merged ticket whose `outcome.md` is missing, has no `- Cost:` line, or says `n/a` for the worker (its cost file was missing at the merge) is left out and counted on the last line, which is left out when there is none.

With no merged ticket, one line says so: `No merged ticket in <project> yet.` It reads only: nothing is written. More than nothing after `budget` prints `usage: arthur stats budget [--project <name>]` and exits 2; an unknown project exits 1 with the board's refusal.
