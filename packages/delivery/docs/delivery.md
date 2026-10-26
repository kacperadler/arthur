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
