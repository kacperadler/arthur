# arthur merge

Usage: `arthur merge <job> [--unreviewed]`. Comes with the `delivery` plugin, `delivery()` in `arthur.config.ts`; it takes no option.

Merges an ended job's branch into the branch its project's checkout has checked out, main, then does the rest of a merge's mechanical part. The job is its full id or the 8 hex digits that end it: a worker, or any job with a branch, an onboarding included. It commits nothing but the merge and prunes nothing; main is pushed only by the plugin that provides `github.push`, when one is loaded. The procedure it prints last says what the coordinator does next.

## The PASS

A branch goes in only when its tip, the commit it merges, has a PASS: the newest review of that commit with a verdict says `PASS` (`arthur review --help`), or `arthur review-needed` answered `no review` for that commit (`arthur review-needed --help`). A commit after the PASS needs a new one. `--unreviewed` lets the branch in without it, on the owner's word only; `outcome.md`'s `Reviews:` line then ends `; merged unreviewed (--unreviewed): no PASS on …`. An onboarding is never reviewed, so its merge, which only the owner decides, is always `--unreviewed`.

## Refused, touching nothing

Exit 1, main unchanged, nothing written or moved:

- No such job: `arthur merge: no job <name>; arthur jobs lists them`; a read-only one: `<id> is a <kind> job, read-only: it has no branch to merge`; one still in a run: `<id> is in a run (<state>); merge its branch once the run has ended`.
- The job's project not in the list; its branch not in the project's checkout: `arthur/<id> is not in <folder>: pruned, or not brought back from its machine`; a checkout on a detached HEAD: `<folder> has no branch checked out (a detached HEAD); check out its main branch first`.
- A task naming several tickets: `<id>'s task names 2 tickets (…); a merge is of one ticket's branch`. Its one ticket not on the board; not `in-progress`, `review` or `done`: `AC0001 is merged; a merge is of a ticket in-progress, review or done`; or with an `outcome.md` already: `<folder>/outcome.md already exists: <id> was merged before`.
- A dirty main: `main has uncommitted changes in <paths>; commit or stash them first; main is unchanged`. The board, `spec/build.json`, does not count: the moves since the last commit wait there for the commit after a merge. Untracked files do not count either, filed reviews among them; `git merge` refuses one it would overwrite (below).
- A branch with nothing main lacks: `arthur/<id> at <commit> adds nothing to main (<commit>): nothing to merge`.
- No PASS on the tip, without `--unreviewed`: `no PASS on arthur/<id>'s tip <commit>: <why> (last PASS: <commit>|none); review it with arthur review <id>, or merge it with --unreviewed on the owner's word only; main is unchanged`, `<why>` being `no review of it has a verdict` or `its newest review, <review job>, says FAIL`.
- `collect("merge.check", job)`, asked last with the job as `arthur jobs` holds it (`id`, `kind`, `project`, `branch`, …): any text answer refuses, every answer named: `refused by merge.check: <answer>; <answer>; main is unchanged`. The projects plugin answers for an onboarding, whose branch may change only the vision and the criteria files (`arthur init --help`).

Wrong usage (no job, two, an unknown flag) prints the usage line and exits 2.

## Steps

Each printed as it is taken:

1. `git merge --no-ff -m "Merge <ticket>: <title>" <tip>` (`Merge arthur/<id>` for a job naming no ticket), then `merged arthur/<id> into main: <hash>`. A conflict aborts the merge, `arthur/<id> conflicts with main in <files>; merge aborted, main is unchanged`; any other failure of `git merge` is `git merge arthur/<id> failed: <git's last line>; main is unchanged`.
2. Checks on main. Every step runs on the PATH the plugin that provides `nvm.path` (the nvm plugin) answers for `{ root }`, main's checkout: the bin of the Node its `.nvmrc` names first, as a worktree there gets it; `""`, or no plugin providing it, runs them on the PATH `arthur merge` has. A throw of `nvm.path` (that Node not installed, nvm missing) runs nothing and is a failed step: `node: failed, <message>.`. First the project's install, the one a new worktree of the merge commit gets, as the plugin that provides `projects.install` (the projects plugin) answers for `{ project, commit: "HEAD" }`: the project's `install` in `arthur.config.ts` when set, else the frozen install of its one known lockfile (`arthur projects --help`, "Install"); `install: ""`, or no lockfile and no `install`, runs nothing. A throw of `projects.install` (two known lockfiles and no `install`, or no plugin providing it) runs nothing and is a failed step: `install: failed, <message>.`. Then `npm run check` and `npm test`, each only when main's `package.json` declares its script; with neither, and no install, `no checks: package.json declares no check or test script`. Each prints `<command>: passed.`, `12/12 passed.` or `failed, 11/12 passed.` (the counts from node --test's last summary, when it printed one), and a failed one its last 20 lines. A failed `nvm.path` or install, or a `package.json` that is not JSON, ends the steps.
3. For a job naming no ticket: `no ticket: no outcome.md, nothing moved`, and the merge ends here. Otherwise, files every review of the branch with a verdict that no `review-N.md` of the ticket names yet, as `arthur ticket file` does: `filed <path>`, or `review <job>: not filed: <why>` (a pruned review's result is gone).
4. Hands the ticket's findings to the plugin that provides `findings.onMerge` (the findings plugin), asked with `{ project, ticket, path, root }`, `path` the ticket's `findings.md` from the project's folder whether it exists or not; its answer is the lines of `## Left open`, printed. With no provider the findings stay as they are and the merge says so once: `- Findings: <path> left as it is, every open entry still open: no plugin provides findings.onMerge`, or `- Findings: none; no findings.md on this ticket.` without the file. A provider that throws costs its own line: `- Findings: findings.onMerge of <plugin> failed: <message>; <path> left as it is`.
5. Writes `outcome.md` in the ticket's folder, in the shape of the core's template: `- Merged: <date>, <hash>`, `- Branch:`, `- Reviews:` (the branch's `review-N.md` files with their verdicts), `- Cost: worker $x, reviews $y; review rounds N` (`n/a` when a job's record or its cost is gone), the commit subjects under `## What went in`, each step under `## Checks on main`, and step 4's lines under `## Left open`.
6. Moves the ticket to `merged` (`ticket-moved`, named by delivery), `<id> merged`, and names the `planned` tickets whose `after` it completed: `unblocked: <id>, <id>`.

Then, when a plugin provides `github.push` (the github plugin, `packages/github/docs/github.md`, "Pushes"), main is pushed to origin and that plugin's one line printed, `github: pushed main to origin: <old>..<new>` or the warning `github: main not pushed to origin: <why>` (a push rejected as non-fast-forward, no origin), which leaves the merge in: it is never retried and never asks for a password. Last, `nothing committed but the merge, nothing pruned` (`nothing committed but the merge, nothing pushed or pruned` without that plugin) and the procedure after a merge, `packages/delivery/roles/coordinator/after-merge.md`. A merge that refuses or fails prints none of these and pushes nothing.

## When a check fails

Main goes back to the commit before the merge with `git reset --keep`, which keeps the board's uncommitted moves; nothing is filed or written and no ticket moves. When an install ran in the steps, main's own is run again, as `projects.install` answers for main's HEAD after the reset, on the PATH `nvm.path` answers for it then, `reinstall of main's dependencies, <install>: passed.` or `failed.`. Exit 1 with `check failed on main (<command>); main reset to <commit>, branch kept`, ending `, but reinstalling main's dependencies failed (<install>): they still hold the branch's install` when that install failed. When the reset itself fails: `check failed on main (<command>), and main could not be reset to <commit>: <git's last line>`.

## What the coordinator does with the result

- A merge that went in ends with the procedure: follow it in the same turn.
- `github: main not pushed to origin: …`: the merge is in; follow the procedure, whose push after the board's commit is the next try, and tell the owner the line if that push fails too.
- `check failed on main (…)`: main is as it was. Tell the owner which check failed with its last lines, and recommend `arthur continue <job> '<what failed>'`, then a new review once it ends.
- A conflict, or `refused by merge.check: …`: main is unchanged; tell the owner, in plain words.
- `no PASS on …`: review the branch (`arthur review <job>`), or ask the owner for `--unreviewed`.
