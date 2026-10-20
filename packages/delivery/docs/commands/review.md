# arthur review

Usage: `arthur review <worker job> [--round <n>]`. Comes with the `delivery` plugin, `delivery()` in `arthur.config.ts`; a review takes no option (delivery's `review.alwaysReview` is `arthur review-needed`'s, which says whether a branch needs a review at all).

Starts a review of an ended worker's branch at its tip and prints the review job's id, as `arthur spawn` does (warnings and the model's line on stderr). The worker job is its full id or the 8 hex digits that end it. The review is a job of the kind `review`:

- read-only, in a detached checkout of the branch's tip, made by delivery's `prepare` step after the core's checkout of HEAD, on the job's machine (`git checkout --detach <commit>`); `arthur review` spawns it with the tip as `fetch`, so on another machine the core pushes the tip there with the base (`refs/arthur/fetch`), wherever the worker ran; a commit that still cannot be checked out there refuses the spawn: `plugin delivery: prepare failed: arthur/<id> at <commit> cannot be checked out on machine <name>: <git's last line>`, the worktree and record removed (`arthur spawn --help`);
- role `reviewer` (`packages/delivery/roles/reviewer.md`) with the project's criteria files `styleguide` and `review` (`arthur roles`); a fresh session, on `roles.reviewer` of orchestration's options, else the agent's own model, so a review is not judged by the worker's model when the two differ; the core's limits (`core.jobs`).

Its task starts with the lines placement and delivery read, then the range and the worker's final message:

```
Ticket: spec/features/<id>-<slug>/ticket.md
Branch: arthur/<worker job>
Commit: <the branch's tip>
Round: <n>                 (only with --round)

Review the branch ... The range to judge is <base>..<commit> ... git show <HEAD>:<ticket path> ...

## The worker's final message (job <worker job>)
```

`<base>` is where the branch leaves the main checkout's HEAD (`git merge-base`). The `Ticket:` line names the worker's one ticket, so placement (`jobs.place`, the machines plugin) reads that ticket's `requires` labels and a review of a ticket with `os=macos` runs on a macOS machine, as its worker did. `Ticket:` in the worker's message is written `Ticket\:`, so it names no second ticket.

`arthur spawn --kind review '<task>'` with the same head lines is the same review: every refusal below holds for it too.

## The verdict

The last line of the review's final message, exactly `PASS` or `FAIL`, alone. Anything else is no verdict: `**PASS**`, `Verdict: PASS`, a verdict followed by any text, a `PASS` above other lines.

- At the review's start (`job-started`) its ticket moves to `review`.
- At its end (`job-ended`): `PASS` moves the ticket to `done`, `FAIL` back to `in-progress`. No verdict, or a run that did not finish (failed, stopped, a limit, blocked), moves nothing: the review failed, its ticket stays at `review`, and it is never filed. The kind is registered with `verdicts: ["PASS", "FAIL"]`, so the core ends a run without one `failed: no verdict: the last line of its final message is not PASS or FAIL alone`, in its record, `arthur jobs` and `job-ended` (`arthur spawn --help`).
- The verdict is kept in delivery's record of the review, `<home>/delivery/reviews/<job>.json` (its ticket, branch, commit, start), so a review still counts once `arthur prune` removed its job record.
- The coordinator's wake for an ended review adds one line: the verdict, the ticket's move, and how to file it; for no verdict, that the review failed and how to review again.

## The limit: 2 FAILs since the last PASS

A branch gets at most 2 FAIL reviews since its last PASS, or since its first review without one. Reviews that run, ended with no verdict, or reviewed another branch do not count; a worker's new branch starts again at 0.

- The third review is refused: `refused by delivery: 2 FAILs on arthur/<id> since its last PASS: <review job>, <review job>; the owner decides what comes next, and only on his word: arthur review <id> --round 3`. `arthur review` prints the procedure `packages/delivery/roles/coordinator/review-limit.md` after it, and the wake of the review that made the second FAIL carries the same procedure.
- `--round <n>` (the task's `Round: <n>`) starts it, on the owner's word only: `n` must be the FAILs plus one, else `round <n> is not the next one of arthur/<id>: it has <fails> FAILs since its last PASS, so the next round is <fails + 1>`.

## Refused

Before any job exists, exit 1:

- No such job: `arthur review: no job <name>; arthur jobs lists them`.
- Not a worker: `<id> is a <kind> job; a review is of a worker's branch`; still in a run: `<id> is in a run (<state>); review its branch once the run has ended`.
- A worker whose task names no ticket, or several: `<id>'s task names no ticket; a review is of one ticket's branch`.
- A branch gone from the main checkout: `arthur/<id> is not in <folder>: pruned, or not brought back from its machine`; a branch that adds nothing to HEAD: `arthur/<id> at <commit> adds nothing to HEAD (<commit>): nothing to review`.
- As `refused by delivery: <reason>`, for `arthur review` and `arthur spawn --kind review` alike: a task without exactly one `Ticket: spec/features/<id>-<slug>/ticket.md`; a ticket not on the board; a ticket that is not `in-progress`, `review` or `done` (`<id> is planned; a review is of a ticket in-progress, review or done`); no `Branch: arthur/<worker job>` and `Commit: <sha>` lines before the task's first blank line; the limit above.

Wrong usage (no job, two, an unknown flag, `--round` twice or without a whole number of 1 or more) prints the usage line and exits 2.

## Filing

`arthur ticket file <id> <review job>` (`arthur ticket --help`) files a review that finished as the next `review-N.md` in the ticket's folder, one above the highest N there, and prints its path: `# <id> - Review <N>`, `- Job: <review job>`, `- Branch: arthur/<worker job>`, `- Commit reviewed: <commit>`, `- Verdict: PASS` or `FAIL`, then `## Final message` and the final message as it is. It never replaces a file and never files a job twice: `<job> is already filed as <path>`; a second filer that took the same N meanwhile: `<path> was written meanwhile; file <job> again`. Refused too, by the core: a review that did not finish, no verdict included (`<job> ended ended (failed: no verdict: ...), not finished: its result is unfinished and is never filed; prune it`); and by delivery, a job it has no record of. The coordinator commits what was filed.
