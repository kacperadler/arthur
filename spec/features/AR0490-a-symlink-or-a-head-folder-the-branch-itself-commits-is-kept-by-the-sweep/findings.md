# AR0490 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A merge with no step sweeps nothing, so a repository the branch commits stays in main's checkout

- Kind: security
- Found by: 2026-10-29-worker-6a44e150 (worker), 2026-10-29
- Where: `packages/delivery/src/merge-checks.ts:45` (the sweep runs only inside a step's run), `packages/delivery/src/merge-command.ts:151`
- What: the sweep runs after each step. A project whose `projects.install` answers `""` and whose package.json declares no `check` or `test` script has no step (`no checks: package.json declares no check or test script`). Then a folder holding a `HEAD` and a `config` with `core.fsmonitor`, or a symlink to a folder outside the checkout, that the branch commits stays in main's checkout after the merge, as it did before this ticket. Read from the code (`mainChecks` returns `[]`, so `run` is never called), not run.
- Suggestion: sweep once after `git merge` when no step ran, with `git merge` as the command in the line, or refuse such a branch before `git merge` (the ticket's other option). Out: the sweep's rules.
- Status: deferred (client summary)

## F2. A branch that adds a Git folder as a test fixture fails its checks, and a passed merge leaves main's checkout dirty

- Kind: ux
- Found by: 2026-10-29-worker-6a44e150 (worker), 2026-10-29
- Where: `packages/delivery/src/merge-sweep.ts:20`
- What: what the branch commits now counts as a step's. A tracked folder holding a `HEAD`, or a tracked symlink to a folder outside the checkout, is removed after the install. Tests that read it then fail and main is reset. When the merge passes, main's checkout lacks those tracked files, and the next `arthur merge` refuses with `main has uncommitted changes in <path>` until the owner restores or removes them. The test `what the branch itself commits counts as a step's to the sweep` shows the removal. The refusal of the next merge is read from `merge-command.ts:108`, not run.
- Suggestion: refuse such a branch before `git merge` with a line that names the path, so the owner decides before anything runs. Out: keeping such a folder in main's checkout.
- Status: deferred (client summary)

## F3. A python3 failure on a linked target folder removes the owner's symlink, and the line names the wrong reason

- Kind: ux
- Found by: 2026-10-29-worker-6a44e150 (worker), 2026-10-29
- Where: `packages/delivery/src/merge-sweep.ts:21`, `:96`
- What: a symlink into a folder a step writes is stamped with its target's stamp, and that stamp reads the folder's extended attributes with python3. When python3 fails on one look only, the stamps differ and the symlink is removed. The line then says `a git call in that folder would run its config outside any sandbox`, not the python3 line, and AR0479's retry does not run for it, because the link's stamp does not start with `python3 failed`. The result is safe: the link goes. Read from the code, not run.
- Suggestion: retry and word a symlink's target stamp as `.git` folders are retried and worded (AR0479). Out: the rules of what is judged.
- Status: deferred (client summary)

## F4. Main's checkout with a `.git` file judges no link into its common Git folder by its target

- Kind: security
- Found by: 2026-10-29-review-99b84863 (review), 2026-10-29
- Where: `packages/delivery/src/merge-sweep.ts:14`
- What: `owned` counts only `<checkout>/.git` as the checkout's Git folder. When main's checkout has a `.git` file (a separate git dir), a step writes the common dir's `objects`, `refs` and `logs` (`packages/core/src/job-sandbox.ts:127-129`), but an owner's link into them is stamped by itself only. Read from the code by the reviewer; main is normally a plain clone.
- Suggestion: add the folder `git rev-parse --path-format=absolute --git-common-dir` names, run with the merge's safe git flags, to the folders a step writes. Out: the rest of the sweep.
- Status: deferred (client summary)

## F5. An owner's link into `.git/refs`, `.git/logs` or `.git` is removed after the first step though no step wrote there

- Kind: ux
- Found by: 2026-10-29-review-99b84863 (review), 2026-10-29
- Where: `packages/delivery/src/merge-sweep.ts:105`
- What: the snapshot is taken before `git merge`, and a target's stamp is recursive. `git merge` itself updates `refs/heads/<main>` and the logs, so such a link's target changed by the first step and the link is removed. That is the safe direction, but the owner loses the link. Read from the code by the reviewer.
- Suggestion: take a second look at such links right after `git merge`, before the first step, for the part of `.git` the merge writes. Out: links into the folders a step writes elsewhere.
- Status: deferred (client summary)

## F6. An owner's link to the delivery folder is removed after the first step of every merge

- Kind: ux
- Found by: 2026-10-29-review-358ec032 (review), 2026-10-29
- Where: `packages/delivery/src/merge-command.ts:135`, `packages/delivery/test/merge.test.ts` (`what the branch itself commits counts as a step's to the sweep`)
- What: the delivery folder is a folder a step writes (the merge's caches go there), so an owner's link to it is judged by its target. Each merge adds a `cache_` folder there, which changes it, so the link goes after the first step. The merge test shows it. That is the safe direction, but the owner loses the link.
- Suggestion: pass the merge's cache folders to the sweep instead of the whole delivery folder, made before the runner. Out: the other folders a step writes.
- Status: deferred (client summary)
