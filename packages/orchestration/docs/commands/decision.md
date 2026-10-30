# arthur decision

Usage:

- `arthur decision ask --kind <kind> --question <text> [--ticket <id>] [--job <id>] [--what --unreviewed|--no-ci]... [--option <text>]... [--recommend <n or text>]`
- `arthur decision answer <id> --decided <one line> [--picked <n>] <the owner's words>`
- `arthur decision close <id> <reason>`
- `arthur decision class propose --kind <kind> --match <text> --decided <one line> --backed-by <id>...`
- `arthur decision class revoke <id> <the owner's words>`

Comes with the `orchestration` plugin, which every config holds. It records every decision Arthur asks the owner for, and his answer, in the project's decision log, and the classes of decisions he pre-approved; `arthur decisions --help` reads it.

## The log

Each project keeps one append-only file, `spec/decisions.jsonl`, next to its board and in Git: the coordinator commits it with the board. Only this command and the plugin itself write it, never a hand: under a lock in `.arthur/orchestration/` (`decisions-<project>.lock`), which this command waits for up to 10 s and the plugin's own records without holding up `arthur run` (up to 60 s, its other work going on meanwhile), the whole file written to `spec/.decisions.jsonl.<pid>` and renamed, so a reader never sees half of it. Each line is one JSON record with its id:

- `ask`: `{ record, id, time, project, kind, question, options, recommend?, ticket?, job?, what?, class? }`, `what` the merge flags the decision lets through (below), `class` only on a class's proposal (kind `class`, below);
- `answer`: `{ record, id, time, decided, picked?, words }`, `words` `by policy: <class id>` for an answer given by policy, `by recommendation: <grant id>` for one the owner's grant gave (`arthur silent --help`, "Go with my recommendation");
- `close`: `{ record, id, time, reason }`;
- `revoke`: `{ record, id, time, words }`, the owner revoking a class.

`time` is the local time in `core.timeZone` with its offset (`2026-10-22T08:40:00+02:00`). Before a record is written, every text it holds (the question, the options, a recommendation in words, the owner's words, the decision, a reason, a class's words and decision) is redacted with the notices' rules: every value of an enabled plugin's `...Env` variable, from the shell or the env file, the value of every variable whose name says it holds a secret (either 8 characters or more), a bearer token, a key with a vendor's prefix, and any run of 20 or more letters, digits, `_` and `-` that mixes letters and digits, which takes a job id and a full commit hash too. The id, the ticket and the job are kept.

## Asking

`ask` records a question and prints its id: the project's prefix, `-D` and the next number (`AR-D12`). The project is the main one, or `--project <name>`. Name that id in the message that asks the owner.

The kinds:

- `job`: a job blocked on the owner. The plugin records it by itself when the job turns `blocked: user <question>`, with the job and its ticket, and the notice names it: `<job> asks [AR-D12]: <question>`; a job blocked twice asks twice. The wake of its run names the id and the command to answer it. While another process holds the log's lock, the question is recorded and the notice sent once the lock is free; a wake written before says `Its question was not in the decision log yet` and how to find its id (`arthur decisions --kind job`). Past 60 s the notice goes naming no decision and the event fails, logged with the plugin's name.
- `question`: a question in the coordinator's reply.
- `plan`: a planning ticket's plan waiting for the owner's approval (`arthur plan --help`).
- `review`: what comes after a branch's second FAIL (`arthur review --help`).
- `budget`: a raise of a package's line budget, or a job with no money limit (`--budget 0`, below).
- `merge`: a merge without a PASS or without CI (`arthur merge --unreviewed` or `--no-ci`, below).

`--option` gives an option offered, once each, numbered from 1 in the order given; `--recommend` is the coordinator's recommendation, an option's number or words. `--what` names a merge flag the owner's answer lets through, `--unreviewed` or `--no-ci`, once per flag, only with `--kind merge` (AR0533); a merge decision without it lets no flag through. While the owner's grant of `arthur silent on ... --recommend` holds, an ask with `--recommend` that no class answers is answered by that recommendation in the same write, but never a merge with `--what`, a `budget` question or a class's proposal, and prints `<id> answered by recommendation (<grant id>): <decided>; act on it as on the owner's answer, and say so in your reply` (`arthur silent --help`).

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

## Classes

A class is a kind of question the owner always answers the same way, pre-approved on his word only, as autopilot pre-approves a ticket. It is a kind (one of the six), the words its questions name, and, when every backing decision's ticket says the same `- Kind:` under its Goal, that ticket kind; and the decision it gives.

`class propose` records the proposal as a question of its own, kind `class`, and prints its id, then the class and its evidence: the backing decisions, each one the owner answered (the later answer counts) with the same decision (the words compared in any case and spacing), of the class's kind, whose question names every word of `--match`; and the agreement rate of the coordinator's recommendation with the owner's pick on them, the case the evals score. A decision with no recommendation or no pick is not scored, and says so. `--backed-by` takes the ids after it, or once per id. The proposal's options are `Approve the class` and `Refuse it`, recommended 1, and `arthur decisions <id>` prints it whole.

Ask the owner with that id, the class, its backing decisions and their agreement rate. His answer is `arthur decision answer <id> --picked 1` (approve) or `--picked 2` (refuse), with `--decided` and his words, as any answer; the later answer counts. Only an approved class holds, from its answer on; a proposed, refused or closed one answers nothing.

Then each `ask` of the class's kind whose question names every word of `--match` (words of letters and digits, in any case), its ticket of the class's ticket kind when it has one, is answered in the same command, under the same lock: its answer is the class's decision, `by policy: <class id>` in place of the owner's words, and its ticket's Decisions line names the class, never the owner:

```
- YYYY-MM-DD: <decided>; pre-approved by policy (AR-D7)
```

The `ask` prints a second line, `<id> answered by policy (<class id>): <decided>; act on it as on the owner's answer, and say so in your reply`. A job's question answered so continues the job by itself (AR0583): the plugin runs `arthur continue <job> '<decided>'` once, the decision its instruction, when the job's record is blocked at the end of its run, or at its run's end when a plugin held it then (`<home>/orchestration/continued/<decision id>` marks it done); its notice ends ` — answered by policy (<class id>): <decided>`, so the owner's phone shows it decided, and the wake says `The job is continued by policy (<class id>) with that decision`, or, with no record of it blocked on that question, that it was not continued. A continue that fails reaches the coordinator as a message of its own, `<job> was not continued by policy (<class id>): <why>; arthur continue <job> '<decided>' continues it with that decision.` A question two or more approved classes match is left to the owner: its second line is `<id> goes to the owner: it matches classes <id> and <id>`. A class never answers a class's proposal.

`class revoke` records the owner's revoke; from then the class's questions go to him again, and the answers given by policy before stay as recorded. A later answer approving the proposal again holds again. `arthur decisions --classes` lists each class, proposed, approved, refused, revoked or closed, with its evidence and the questions it answered.

## What only the owner's decision lets through

`arthur merge <job> --unreviewed` or `--no-ci` (AR0503), and `--budget 0` of `arthur spawn` or `arthur continue` on a paid model go on only with `--decision <id>` (AR0355). The plugin checks it, `call("decision.owner", …)` for the merge and its `beforeSpawn` for the spawns, and refuses, naming why: no id (naming the ask to make, `arthur decision ask --kind merge --what <flag>|budget --question '<what he decides>' --ticket <id>`); an id the log does not hold; a question of another kind (`merge` for the merge, `budget` for the spawns); one open or closed; one whose later answer is by policy; one of another ticket than the job's (the first its task names), or, for a job naming none, of another job, or, for a spawn naming none, one with a ticket or a job; for a merge, one whose `--what` does not name the flag (AR0533): `<id> lets through <its flags, or no merge flag>, not <flag>: ask the owner for <flag> with arthur decision ask --kind merge --what <flag>`, so a decision for `--unreviewed` never lets `--no-ci` through, and `arthur merge <job> --unreviewed --no-ci --decision <id>` needs one asked with both; one used already. A pass marks it used in `<home>/orchestration/used/<id>`, created whole or not at all, holding what used it (`merge <job>`, `spawn`, `continue <job>`): only the same job's merge tried again (after a conflict or a failed check) passes it again, since a branch goes in once. A spawn or continue refused by a later plugin's check has used it too: ask again.

`arthur take-main` (the delivery plugin, AR0441) asks `decision.owner` the same way, kind `merge`, for no ticket and no job: an ask with neither (`arthur decision ask --kind merge --question '<what he decides>'`), used once; it is no merge flag, so `--what` is not checked.

## Refused

Each refusal prints `arthur decision <verb>: refused: <why>`, writes nothing, and exits 1:

- Inside a job (`arthur help --help`), every verb, `class` included: a job never records the owner's word; it ends its run with `Blocked: user <question>`.
- `ask`: an empty or missing `--question`; a `--kind` other than the six; a `--ticket` not on the board of the project; a `--recommend` number with no such option; an unknown `--project`.
- `answer`: an id the log does not hold, or whose prefix no project has; no owner's words; owner's words that begin `by policy` (only `ask` answers by policy, and a class is approved on the owner's word only); no `--decided`, or an empty one; a `--picked` that is no option's number; no `--picked` to a class's proposal.
- `close`: an id the log does not hold; no reason; a question already answered or closed.
- `class propose` (`arthur decision class propose: refused: <why>`): `--kind class` (a class never approves a class) or another kind outside the six; a `--match` with no word; no `--decided`; no backing decision; a backing id the log does not hold, one not answered (open or closed), one answered by policy, one whose decision differs from `--decided`, one of another kind, or one whose question does not name every word of `--match`; an unknown `--project`.
- `class revoke`: an id the log does not hold, or that is no class; a class already revoked; no owner's words.
- Any verb, when a line of the log is not a record (a hand edit): `<file> line <n> is not a decision record (<why>); ...`, the file left as it is; for a class, an approval by policy, an answer by policy naming no class above it, or a revoke of no class too. Undo the edit (`git diff -- spec/decisions.jsonl`).

Wrong usage (no verb, an unknown flag, a flag without its value or given twice, words after `ask`, a `--what` other than `--unreviewed` or `--no-ci` or without `--kind merge`, no id after `answer`, `close` or `class revoke`, `class` without `propose` or `revoke`, ids after `class propose` with no `--backed-by`) prints the usage and exits 2.
