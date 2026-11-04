# AR0627 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The spec: commit of a merge is checked only after it is pushed

- Kind: security
- Found by: 2026-11-04-worker-331520f3 (worker), 2026-11-04
- Where: `packages/delivery/src/merge-outcome.ts:76`
- What: `arthur merge` commits `spec: <id> merged` after the checks on main, with hooks off, and `github.push` pushes it at once. Its files are written by the merge itself: `outcome.md` (the worker's `## What went in` lines, copied from its final message), `CHANGELOG.md` and `spec/build.json` (ticket titles). A project name in them is caught by `test/other-projects.ts` only at the next `npm test` or the next commit with `.githooks` on, after it is on GitHub.
- Suggestion: before the spec: commit, run a command the project names (for Arthur, `node test/other-projects.ts` on the paths it commits) and leave the commit to the coordinator when it fails, as a config key set during the checks does today. The hooks stay off.
- Status: deferred (client summary)

## F2. Other projects of the owner that are not in projects/ are not checked

- Kind: security
- Found by: 2026-11-04-worker-331520f3 (worker), 2026-11-04
- Where: `spec/decisions.jsonl:899`
- What: the check takes its names from `projects/` only. A project of the owner that is not an Arthur project is not seen: AR-D446 to AR-D448 (`spec/decisions.jsonl:899-904`) name a course project of the owner, its private repository and its home folder.
- Suggestion: reword those decisions with a made-up name; and, if the owner wants such projects checked, a git-ignored file of extra names the check reads beside `projects/`.
- Status: deferred (client summary)

## F3. A project named with a common word fails Arthur's own npm test

- Kind: risk
- Found by: 2026-11-04-worker-331520f3 (worker), 2026-11-04
- Where: `test/other-projects.ts:49`
- What: a name is matched as a substring, in any case. A user who follows `docs/setup.md` literally has `projects/shop`, and Arthur's tracked tests and docs name `shop` hundreds of times, so `npm test` in that clone fails on `test/other-projects.test.ts` [INFERENCE: from the matching code; not run on such a clone].
- Suggestion: run the repository-wide test only where `origin` is Arthur's own repository, or let `projects/<name>/` hold a marker that excludes a name; the owner decides which.
- Status: deferred (client summary)

## F4. A sign-off with the owner's address is refused

- Kind: risk
- Found by: 2026-11-04-worker-331520f3 (worker), 2026-11-04
- Where: `CONTRIBUTING.md:5`
- What: the owner's email domain is the folder name of one of his projects. `CONTRIBUTING.md` asks for a `Signed-off-by:` line on every commit, and older commits carry it with that address (`git log --format=%B | grep -ciF <the domain>` counted 184 lines); with `.githooks` on, the hook refuses a commit that signs off so, and `npm test` fails on a merge whose branch does. Arthur's recent commits carry no sign-off.
- Suggestion: the owner picks a sign-off address that names no project, or the check leaves a `Signed-off-by:` trailer's address out; the owner decides.
- Status: fixed in 67a5d3d7

## F5. A plan names the addresses of two servers

- Kind: security
- Found by: 2026-11-04-worker-331520f3 (worker), 2026-11-04
- Where: `spec/features/AR0604-plan-the-docker-plugin-and-the-core-cleanup-hook-roadmap-70-to-72/plan.md:43`
- What: the line names the public IP address of the owner's deploy host and of this VPS, which the vision keeps out of the repository (its folders on a server).
- Suggestion: replace both with `<deploy host>` and `<this VPS>`.
- Status: deferred (client summary)

## F6. On another machine the check has no names

- Kind: risk
- Found by: 2026-11-04-worker-331520f3 (worker), 2026-11-04
- Where: `test/other-projects.ts:23`
- What: the names are read from `projects/` beside the repository's Git folder. A job on another machine runs in a worktree of `<home>/repos/arthur.git`, beside which no `projects/` lies, so its `npm test` and its hook check nothing [INFERENCE: from `docs/deploy.md`, "Another machine for jobs"; not run there]. The merge on main, here, still checks.
- Suggestion: none needed while the merge gate holds; or send the names with the job.
- Status: deferred (client summary)

## F7. the `spec: <id> merged` commit is made with hooks off

- Kind: fix
- Found by: 2026-11-04-review-416e6684 (review), 2026-11-04
- Where: `packages/delivery/src/merge-command.ts:89`
- What: Its files are checked only by the next `npm test` on main, after the push. The worker filed this as F1, and the line at `docs/setup.md:121` says "every commit there" without this exception.
- Status: deferred (client summary)

## F8. when `projects/` is missing or can't be read (a job on another machine, a sandbox that hides it), the check sees no names and passes without saying so

- Kind: fix
- Found by: 2026-11-04-review-416e6684 (review), 2026-11-04
- Where: `test/other-projects.ts:24`
- What: This is F6; I didn't run that case.
- Status: deferred (client summary)
