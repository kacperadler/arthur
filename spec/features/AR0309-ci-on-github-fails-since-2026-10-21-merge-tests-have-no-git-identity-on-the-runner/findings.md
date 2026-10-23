# AR0309 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. `arthur merge` fails for a user with no git identity, only after its review and checks ran

- Kind: bug
- Found by: 2026-10-23-ar0309-ci-git-identity-98a66810 (worker), 2026-10-23
- Where: `packages/delivery/src/merge-command.ts:85`
- What: `arthur merge` runs `git merge --no-ff -m …` in the project's checkout with whatever identity Git finds. A user whose git has no `user.name`/`user.email` (a fresh machine or container, as GitHub's ubuntu runner) gets `arthur merge: git merge arthur/<id> failed: fatal: unable to auto-detect email address (got '<user>@<host>.(none)'); main is unchanged`. Reproduced with `packages/delivery/test/auto-merge.test.ts` before AR0309's fix, under `HOME=<empty folder> GIT_CONFIG_NOSYSTEM=1`: 5 of 6 tests failed with that line. Nothing is lost (main is unchanged), but the refusal comes only at merge time, after a worker and a review were paid for, and its wording does not say what to set.
- Suggestion: check for an identity where Arthur first needs one (`arthur init` or the host's start, as a health line) and name the fix (`git config --global user.name/user.email`, or repo-local); keep Arthur from inventing an identity of its own.
- Status: ticket AR0310
