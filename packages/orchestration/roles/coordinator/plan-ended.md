# When a plan or a plan review ends

A ticket with `- Plan: yes` under its Goal gets a worker only with the plan the owner approved: a worker's `arthur spawn` is refused until the ticket's `plan.md` is committed, a line under its Decisions records the owner's approval of that `plan.md`, and the task has a `Plan:` line naming it (`arthur plan --help`).

A plan (kind `plan`) that finished:

1. `arthur ticket file <ticket id> <job id>` writes the ticket's `plan.md`, replacing the earlier one, whose versions stay in Git history, and prints its path. Commit that file alone, then `arthur prune <job id>`.
2. Read the whole plan with `arthur plan <ticket id>`: the message above shows only its first lines.
3. Send the owner the plan in plain words, at most 5 lines, with the ticket described in a sentence: lead with any `Not available directly` item, what is missing and its options with the plan's recommendation, and ask the owner to choose before the ok; then what changes, what is left alone, and the plan's open questions, each a self-contained question. `/plan <ticket id>` shows the whole plan on the phone. When the owner picks an option other than the recommended one, step 5 applies.
4. On the owner's ok: add `- YYYY-MM-DD: Plan approved by the owner: plan.md at <commit>` under the ticket's Decisions, `<commit>` the commit of step 1 (`git log -1 --format=%h -- spec/features/<id>-<slug>/plan.md`); set the ticket `planned` with `arthur ticket status <ticket id> planned` when it is `planning`; commit the ticket and the board together; then spawn the worker with `Ticket: spec/features/<id>-<slug>/ticket.md` and, on a line of its own, `Plan: spec/features/<id>-<slug>/plan.md`.
5. When the owner wants the plan changed: `arthur spawn --kind plan` again, its task the `Ticket:` line and, below it, what the owner wants changed; then start again at step 1. Until the owner approves the new plan at step 4, a worker is refused, since the approval names the earlier plan.

A plan or plan review that did not finish (stopped, past its time or budget limit, a plan after its one resume at the budget, or failed) is never filed: `arthur ticket file` refuses it and says why. Tell the owner what happened, in a line, and `arthur prune <job id>`.

A plan review (kind `plan-review`), spawned only when the owner asks for one, with `arthur spawn --kind plan-review 'Ticket: spec/features/<id>-<slug>/ticket.md'`: `arthur ticket file <ticket id> <job id>` writes the next `plan-review-N.md`; commit it, `arthur prune <job id>`, and send the owner the verdict and the main findings in plain words, with the ticket described in a sentence. The plan still waits for the owner's ok; a FAIL is a reason to recommend a new plan, not an approval or a refusal on its own.
