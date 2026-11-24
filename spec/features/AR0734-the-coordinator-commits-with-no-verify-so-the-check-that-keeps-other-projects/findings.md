# AR0734 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. AR0667's T2 (`arthur commit-board`) still has no ticket: a worker's branch may not add one

- Kind: security
- Found by: 2026-11-24-worker-3bbca2dc (worker), 2026-11-24
- Where: `packages/orchestration/src/paper-check.ts:8`
- What: AR0734's second Done means point asks its worker for a new planning ticket. A worker cannot make one: `arthur ticket` is refused inside a job (`arthur help --help`, "Inside a job"), and `merge.check` refuses, at `arthur review-needed` and at `arthur merge`, a worker's branch that adds a `spec/features/*/ticket.md` or changes `spec/build.json` (`paper-check.ts:8`, `arthur merge --help`). So this branch holds the two role lines only, and T2 is still without a ticket: `arthur board`, run in the config folder on 2026-11-24, lists no ticket that names `commit-board`.
- Suggestion: the coordinator files it with `arthur ticket new`, its source the approved plan `spec/features/AR0667-plan-the-coordinator-in-a-sandbox-with-arthur-run-as-a-broker-for-its-writing/plan.md`, step T2 (approved as AR-D594), and proposal 1 of the audit `spec/quality/2026-11-24.md`: delivery gets `arthur commit-board '<subject>' [--project <name>]`, which commits only the board's files after `checkConfig` and the project's `commit-msg` script (`vetted` in `packages/delivery/src/merge-outcome.ts:92`, exported for it), and `arthur init` commits the files it created; the files are the plan's "Files", T2. Two things the plan does not hold, for that ticket's planning: `packages/orchestration/roles/project.md`, written after the plan, names the commit too (its line 30); and the plan's paths (`spec/build.json`, `spec/decisions.jsonl`, the `.md` files under `spec/features/`) leave out what the coordinator also commits today, `spec/schedule.json` (53c66c4e), `spec/quality/<date>.md` (2d4fbf8c) and `spec/retro/<date>.md` and `.html` (754a0a37).
- Status: deferred (client summary)

## F2. A decision record the hook refuses has no command that rewords it

- Kind: security
- Found by: 2026-11-24-worker-3bbca2dc (worker), 2026-11-24
- Where: `packages/orchestration/docs/commands/decision.md:15`
- What: the role lines AR0734 adds say a commit a hook refuses is reworded, never forced. For a commit message, a ticket or the schedule that is an edit. For `spec/decisions.jsonl` it is not: the log is append-only and "Only this command and the plugin itself write it, never a hand" (`decision.md:15`), and no verb of `arthur decision` changes a record's question or options. The commit this ticket is about, 34d2eb9a, was exactly that case: an `ask` record whose options named other projects. Commit 9339d9c4 took the names out by changing the record's line (`git show --numstat 9339d9c4`: 2 added, 1 removed in `spec/decisions.jsonl`). So the next question that names another project leaves the coordinator between a hand edit of the log and a commit the hook refuses.
- Suggestion: the second half of F2 of AR0713, which AR0734 does not carry: `arthur decision ask` refuses the question before it is recorded, by running the project's `commit-msg` script on the record as `vetted` does (`packages/delivery/src/merge-outcome.ts:92`), or `arthur commit-board` (F1) says what to do with a refused record; and the role says where a question about another project is asked (`--project <name>`, that project's own log).
- Status: deferred (client summary)

## F3. No eval holds the rule that a commit never skips the hooks

- Kind: test
- Found by: 2026-11-24-worker-3bbca2dc (worker), 2026-11-24
- Where: `packages/orchestration/evals/`
- What: the rule is one sentence in two role files, and nothing checks that the coordinator follows it: none of the five scenarios in `packages/orchestration/evals/` (`env-refusal`, `later-is-a-ticket`, `morning-report`, `night-one-line`, `no-sleep`) has the agent commit. `git commit -n` and `git -c core.hooksPath=/dev/null commit` both went past a `commit-msg` hook that refused the plain commit, in a temporary repository (exit 1 plain, exit 0 each).
- Suggestion: a scenario whose fixture has a `commit-msg` hook that refuses the first subject the turn leads to, with `expect.tools` naming `--no-verify`, ` -n ` and `core.hooksPath` in a `git commit` as never run, as `no-sleep/scenario.json` does for `sleep`; until `arthur commit-board` (F1) takes the commit out of the agent's hands.
- Status: deferred (client summary)
