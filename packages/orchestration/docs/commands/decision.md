# arthur decision

Usage:

- `arthur decision ask --kind <kind> --question <text> [--ticket <id>] [--job <id>] [--option <text>]... [--recommend <n or text>]`
- `arthur decision answer <id> --decided <one line> [--picked <n>] <the owner's words>`
- `arthur decision close <id> <reason>`

Comes with the `orchestration` plugin, which every config holds. It records every decision Arthur asks the owner for, and his answer, in the project's decision log; `arthur decisions --help` reads it.

## The log

Each project keeps one append-only file, `spec/decisions.jsonl`, next to its board and in Git: the coordinator commits it with the board. Only this command and the plugin itself write it, never a hand: under a lock in `.arthur/orchestration/` (`decisions-<project>.lock`), the whole file written to `spec/.decisions.jsonl.<pid>` and renamed, so a reader never sees half of it. Each line is one JSON record with its id:

- `ask`: `{ record, id, time, project, kind, question, options, recommend?, ticket?, job? }`;
- `answer`: `{ record, id, time, decided, picked?, words }`;
- `close`: `{ record, id, time, reason }`.

`time` is the local time in `core.timeZone` with its offset (`2026-10-22T08:40:00+02:00`). Before a record is written, every text it holds (the question, the options, a recommendation in words, the owner's words, the decision, a reason) is redacted with the notices' rules: the value of every variable whose name says it holds a secret, a bearer token, a key with a vendor's prefix, and any run of 20 or more letters, digits, `_` and `-` that mixes letters and digits, which takes a job id and a full commit hash too. The id, the ticket and the job are kept.

## Asking

`ask` records a question and prints its id: the project's prefix, `-D` and the next number (`AR-D12`). The project is the main one, or `--project <name>`. Name that id in the message that asks the owner.

The kinds:

- `job`: a job blocked on the owner. The plugin records it by itself when the job turns `blocked: user <question>`, with the job and its ticket, and the notice names it: `<job> asks [AR-D12]: <question>`; a job blocked twice asks twice. The wake of its run names the id and the command to answer it.
- `question`: a question in the coordinator's reply.
- `plan`: a planning ticket's plan waiting for the owner's approval (`arthur plan --help`).
- `review`: what comes after a branch's second FAIL (`arthur review --help`).
- `budget`: a raise of a package's line budget.

`--option` gives an option offered, once each, numbered from 1 in the order given; `--recommend` is the coordinator's recommendation, an option's number or words.

## Answering

`answer` records the owner's answer on the turn it comes: his words as he wrote or said them (a voice note's transcript), in his language, after the flags; `--decided` the decision in one English line; `--picked` the number of the option he chose. An answer that names no id is matched by the coordinator to the open question it answers, and the reply names the id it recorded, so the owner sees the match and corrects it with a new answer. A second answer to one id is a new record, and the later counts. An answer after a close is recorded too: the owner's word outranks the close.

The answer to a question with a ticket is then written under the ticket's `## Decisions` (the heading added when the ticket has none), after the log:

```
- YYYY-MM-DD: <decided>; the owner: "<his words>" (AR-D12)
```

A plan approval keeps the form the worker check reads when `--decided` is `Plan approved by the owner: plan.md at <commit>`, with the short hash (`git log -1 --format=%h`): a full hash is redacted. A line longer than 400 characters has the owner's words cut and ends `(AR-D12, cut: arthur decisions AR-D12 prints it whole)`. A question with no ticket stays in the log only.

A crash between the log's line and the ticket's leaves the line out; the next `arthur decision` of that project, or the plugin's own next record, writes every line missing, found by its id, in the log's order. A line a human edited is never rewritten (`arthur decisions` names it); a line deleted by hand is written again. A ticket line that cannot be written leaves the record in the log, says why, and exits 1.

## Closing

A question with no answer stays open and never expires: every turn's context lists it (below). A `close` record with its reason ends it once what it waits on is gone, written by the plugin itself: `job continued` when its job runs again, `job ended`, `ticket merged` or `ticket dropped`; or by `arthur decision close <id> <reason>`. An open or closed question is never a decision.

## What reads it

- The coordinator's context (`arthur coordinator context`), `## Open decisions`: each open question of every project, with its id, kind, ticket or job, how long it has been open and the question, and under it up to 5 answered decisions like it: the same kind first, then the most words of 3 letters or more shared with the question, the newest answer on a tie, one line each with the question, the decision and its date. No open question, no section; a log broken by hand is one line naming it.
- `arthur decisions`, which lists, searches and prints it.
- The evals (roadmap entry 67) and the decision models read the file as it is; no reader of theirs is built yet.

## Refused

Each refusal prints `arthur decision <verb>: refused: <why>`, writes nothing, and exits 1:

- Inside a job (`ARTHUR_JOB` set), every verb: a job never records the owner's word; it ends its run with `Blocked: user <question>`.
- `ask`: an empty or missing `--question`; a `--kind` other than the five; a `--ticket` not on the board of the project; a `--recommend` number with no such option; an unknown `--project`.
- `answer`: an id the log does not hold, or whose prefix no project has; no owner's words; no `--decided`, or an empty one; a `--picked` that is no option's number.
- `close`: an id the log does not hold; no reason; a question already answered or closed.
- Any verb, when a line of the log is not a record (a hand edit): `<file> line <n> is not a decision record (<why>); ...`, the file left as it is. Undo the edit (`git diff -- spec/decisions.jsonl`).

Wrong usage (no verb, an unknown flag, a flag without its value or given twice, words after `ask`, no id after `answer` or `close`) prints the usage and exits 2.
