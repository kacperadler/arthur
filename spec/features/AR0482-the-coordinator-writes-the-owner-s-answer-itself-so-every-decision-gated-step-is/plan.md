# AR0482 - Plan

- Job: 2026-11-08-plan-4a301e76
- Planned at: a0bbb1d49b118fe6d8ce2fc7880a75d243e06499

## Approach
This ticket delivers only this plan. It lists the ways to close F1 of AR0403 and recommends one. No code changes here. Building the option the owner picks is follow-up tickets (Scope, Out).

**What happens today.** The coordinator records the owner's answer itself, from its own shell:
- `answer` in `packages/orchestration/src/decision-writes.ts:35-50` refuses only two things: empty words, and words that start with "by policy".
- `refusal` in `packages/orchestration/src/decision-use.ts:24-60` lets through any answer that was not given by policy or by recommendation.
- So a coordinator steered by outside text can ask a question, answer it, and use it for:
  - `arthur merge --unreviewed|--no-ci --decision` (`packages/delivery/src/merge-command.ts:129`);
  - `--budget 0`;
  - `arthur take-main` (`packages/delivery/src/take-main.ts:55`).
- The line numbers in the finding have moved: `answer` is now in `decision-writes.ts`, not `decision-log.ts:180-191`.
- Two more grants of authority come from the shell the same way:
  - a class approval, `--picked 1`;
  - the "go with my recommendation" grant, `arthur silent on … --recommend`. Its phone form, `/silent`, takes no grant (`silent.ts`, phone `reply`). Through it, a plan question can be answered by recommendation.
- Three steps have no owner check at all: `arthur ticket status <id> planned` (`board().move` in `packages/core/src/ticket-command.ts`), `arthur spawn`, and `arthur merge` after a PASS.

**What already exists to build on.**
- Every owner message is an event with a number. The inbox keeps its text after media is turned into text, as `{channel, text}`, in `<home>/orchestration/inbox/turn/<seq>-<ms>` while the coordinator works on it. It then moves to `inbox/answered/`, kept 7 days (`inbox.ts` `queue`, `inbox-extension.ts` `KEEP_MS`).
- `actor.ts` already reads `inbox/turn/` to know which messages a turn acts on.
- Phone commands run without the model (`core/src/commands.ts` `route`). They are logged as `phone-command` by `user:<channel>` (`core/src/plugin-host.ts:110`), and both channel menus list them on their own (`telegram/src/menu.ts:12`, `discord/src/menu.ts:18`).

**Options** (A and B are the security review's own suggestion, in its two forms):

- **A. Message proof in `arthur decision answer`.** The answer is refused unless one of the owner's own channel messages holds the words given (ignoring case and spacing). That message must be either:
  - a message of the turn in progress (`inbox/turn/`), which covers a decision he makes unasked, recorded in the same turn; or
  - a message in `inbox/answered/` that came after the question was asked.

  A message marked `[forwarded from …]` never counts. The answer record keeps the message's number (`message: <seq>`), and `arthur decisions <id>` shows it. `decision.owner` passes only an answer that has this proof.

  For the rare high-impact ones (merge flags, `--budget 0`, `take-main`, approving a class), the message must also name the decision id, e.g. "AR-D12 yes". For these, a notice built without the model tells the owner what was recorded: kind, ticket, flags and his words.

  - Variant: the review's `--message <n>` flag means adding the number to the `[via …]` mark in `hand-over.ts`. Letting the command find the message itself gives the same proof with less change. Recommended.
  - Cost: orchestration only. `decision-writes.ts`, the `Answer` type and the record check in `decision-log.ts`, `decision-use.ts`, `silent.ts`, `docs/commands/decision.md`, `coordinator.md`, `roles/coordinator/plan-ended.md`. The largest part is the tests: about 64 `answer` calls in `decisions.test.ts`, and more in `decision-use`, `silent`, `job-states`, `paper-check` and `repeats`, each needing a test owner message.
  - What the owner notices: nothing for ordinary answers. For a high-impact one, he writes the id in his reply, and one round trip is added when he gives such a decision unasked. Text typed in the terminal (`arthur attach`) is no channel message, so it no longer records a decision (Open questions).
  - What it still leaves open: a short real owner message ("ok") can still be reused for another ordinary question that has no id rule. Hand-forged files (Not available directly).

- **B. A `/answer <id> <option number> [words]` phone command.** Orchestration records the answer itself, marked `via: <channel>`. The decision is the text of the picked option. It replies with the question as the log holds it, and wakes the coordinator with a `coordinator-message`.
  - For the high-impact kinds, only this answer passes `decision.owner`, and the shell form of the command must refuse.
  - Cost: a new phone command with its doc, the wake, and asks for these kinds must carry options. A plan approval's option must be the exact line `Plan approved by the owner: plan.md at <commit>`. Tests.
  - What the owner notices: for each such decision he types `/answer AR-D12 1` instead of "yes, merge it". Each one is confirmed back to him without the model.
  - What it still leaves open: the same hand forgery. Two write paths into the log instead of one.

- **C. The coordinator in a sandbox** (see Not available directly).

- **E. Owner checks for the steps that have none** (goes with A or B):
  - `arthur ticket status <id> planned` without `--autopilot` takes `--decision <id>`, a `plan` decision of that ticket with proof. The core asks `decision.owner` by name, as it already asks `ticket.autopilot` (`core/src/host.ts:91`).
  - `arthur merge <job>` after a PASS takes `--decision <id>`, a `merge` decision of its ticket. `--auto` stays policy.
  - `arthur spawn` of a worker then needs nothing new: the core refuses a ticket still in `planning`. `plans.ts` `unplanned` also checks that the approval line's `(AR-Dn)` has a proved answer in the log, so a line written by hand into ticket.md no longer passes.
  - Review, plan and audit jobs are unchanged.
  - Cost: core `ticket-command.ts` and `host.ts`, delivery `merge-command.ts`, orchestration `decision-use.ts` and `plans.ts`, the docs `merge.md`, `ticket.md` and `plan.md`, and `coordinator.md`. Tests in core, delivery and orchestration.
  - What the owner notices: the coordinator asks before every approval and every merge. The log already holds 161 merge questions, but how many plain merges went without one is unknown [INFERENCE].

**Recommendation: A** (the command finds the message; id rule and notice for the high-impact set). Approving a class needs the same proof. The grant moves to the phone only: `/silent on <work> --until … --recommend`, and the shell `--recommend` refuses. **Then E**, as a second follow-up ticket after A.

B is not chosen: it adds new owner syntax and a second writer for the same protection. Its one extra, a confirmation written without the model, A gets from the notice.

Left alone in every option: the policy classes themselves, autopilot, `decision close`, `class revoke` (it only takes authority away), and the used-once marks.

## Not available directly
- **No real limit on what the coordinator can write.** Every check above holds only on the documented commands. The coordinator runs `omp --auto-approve` with bash and only the env guard, inbox and context extensions (`orchestration/src/coordinator.ts:125-126`). The worktree guard and the Landlock sandbox apply to jobs only (`core/src/wrapper.ts:87,131`, `core/src/job-sandbox.ts`). Running as the same OS user, a steered coordinator can still, by hand:
  - write `spec/decisions.jsonl`, a ticket's Decisions, the inbox, or `<home>/events.jsonl` (an appended `message-received` line even comes back as a `[via …]` message);
  - run `git merge` on main.
  - Option 1: bound the documented commands only (A or B) and accept forgery by hand. Cost: as above. Risk: an injection that spells out the forgery still works.
  - Option 2: run the coordinator in a sandbox that cannot write these files, with every writing `arthur` command done by `arthur run` on request. Cost: months; every coordinator command and its commits on main change. Risk: breaks the coordinator's daily work.
  - Option 3: a separate OS user for `arthur run` that owns the logs and main. Cost: install, permissions and setup on every machine. Risk: like Option 2, plus file-ownership breakage.
  - Recommendation: Option 1. The plan follows it; Option 2 can be its own ticket if the owner wants protection against forgery by hand.

## Files
- `spec/features/AR0482-the-coordinator-writes-the-owner-s-answer-itself-so-every-decision-gated-step-is/plan.md`: this plan, filed by `arthur ticket file`. Nothing else changes in this ticket; the files each option would touch are listed under Approach.

## Risks
- **The coordinator paraphrases or translates the owner's words.** Under A such an answer is refused. The refusal must say to quote his words exactly as written. How often today's answers are paraphrased could not be measured: reading `inbox/answered/` was denied in this sandbox [INFERENCE].
- **Discord joins the owner's comment and the forwarded text into one part** (`discord/src/receive.ts:84`). So a forward never counts as proof, and the owner answers in a message of his own.
- **Answers recorded before the change carry no message proof.** After it, `decision.owner` refuses them, so any open high-impact decision is asked again. This is safe, but the owner should hear about it once.
- **No change here can break the build:** this ticket changes no code. Each follow-up keeps the package line budgets in `test/structure.test.ts` (orchestration 2761, core 7438, delivery 2220).

## How to test
- **Plan point:** the filed `plan.md` holds options A, B, C and E, each with its cost and what the owner notices, the security review's suggestion (A and B), and a recommendation. Check by reading it.
- **No code; checks pass.** Run at HEAD `a0bbb1d4` in this checkout:
  - `npm run check`: tsc reported no errors.
  - `npm test`: 1647 tests, 1583 pass, 0 fail, 64 skipped.

  The worker runs both again after filing, and `git diff --stat` should show only `plan.md`.

## Open questions
- Which option: A then E (recommended), A alone, B, or B with E? And should the sandbox (Option 2 under Not available directly) get its own ticket?
- Do you ever record decisions by typing in the terminal (`arthur attach`)? Under A and B only channel messages count, and a terminal-only path cannot be told apart from the coordinator's shell.
- Is typing `/silent on <work> --until … --recommend` on the phone yourself acceptable for the "go with my recommendation" grant, instead of saying it in chat?