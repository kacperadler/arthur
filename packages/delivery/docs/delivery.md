# The delivery plugin

Review and merge of a worker's branch: a plugin, not the core, which stays a job runner. `arthur review <worker job>` starts a read-only review of the branch's tip on the reviewer role (orchestration's `roles.reviewer`); its verdict, PASS or FAIL, moves the ticket, a FAIL hands the work back to the worker, and after 2 FAILs since the branch's last PASS the next review waits for the owner's word. `arthur review-needed` says whether a branch needs a review at all; one that changes a file on the always-review list always does. `arthur merge` merges a branch with a PASS into main and runs the checks on main, on its own after a PASS and green CI for a project with `autoMerge` (an option of `projects`). `arthur take-main` takes main as it is, on the owner's word, and `arthur changelog` writes `CHANGELOG.md` from the merged tickets, as each merge does.

```ts
plugins: [orchestration({}), projects({ list: [...] }), delivery({ review: { alwaysReview: ["**/env.ts", ".github/workflows/**"] } })],
```

## Options

- `review.alwaysReview`: the files a branch that changes one always gets a review for, in every project, as glob patterns from its root; a list replaces the default, which holds what reads secrets, the CI's workflows and its handling, the review rules, the prompt files every role reads, and what a merge and each spawn run (`arthur review-needed --help`, "The always-review list").
- `merge.stepSeconds`: the seconds each step of `arthur merge`'s checks on main (the install, `npm run check`, `npm test`) may run before it is killed and fails the merge; default 3600, an hour (`arthur merge --help`, "Steps").

An unknown option or key, a pattern that is empty or starts with `/`, or a `stepSeconds` that is no whole number of 1 or more, refuses the load.

Each command's page, what `arthur <command> --help` prints, is in [`commands/`](commands/).

## A ticket's jobs

AR0555: what a ticket's jobs hold goes once the ticket needs them no more. `arthur merge` prunes the merged job and every job of the ticket after it pushed main (`arthur merge --help`, "Steps"). A ticket moved to `dropped` (`ticket-moved`, from `arthur ticket status <id> dropped`) prunes every job of the project whose task names a file of the ticket's folder, as `arthur prune` prunes them; a branch Git kept because main does not hold it, of a job that ended on this machine, is then deleted with `git branch -D` and the job pruned again, so its commits go with the ticket, and the github plugin deletes its copy on origin when origin's tip is the one it pushed (`packages/github/docs/github.md`, "Branches on origin"). A job in a run, held or blocked keeps everything, and so does a worktree with changes: Git keeps its branch, checked out there. A repository whose own Git config sets a key that may name a program keeps every unmerged branch, and nothing is run. Each line goes to the log, `delivery: <ticket> dropped: <prune's line>`, then `<branch> deleted, not merged: <ticket> is dropped` and the second prune's line; or `kept every unmerged branch: <file> sets <key>, …`.

Each prune also removes delivery's own folder of the job, `<home>/delivery/<id>/` (its recorded checks, `arthur review-needed`'s answer, a CI wait), through `jobs.keep`; delivery's record of a review, `<home>/delivery/reviews/<id>.json`, stays, for the FAIL counts and the costs in `outcome.md`.
