# AR0490 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A merge with no step sweeps nothing, so a repository the branch commits stays in main's checkout

- Kind: security
- Found by: 2026-10-29-worker-6a44e150 (worker), 2026-10-29
- Where: `packages/delivery/src/merge-checks.ts:45` (the sweep runs only inside a step's run), `packages/delivery/src/merge-command.ts:151`
- What: the sweep runs after each step. A project whose `projects.install` answers `""` and whose package.json declares no `check` or `test` script has no step (`no checks: package.json declares no check or test script`). Then a folder holding a `HEAD` and a `config` with `core.fsmonitor`, or a symlink to a folder outside the checkout, that the branch commits stays in main's checkout after the merge, as it did before this ticket. Read from the code (`mainChecks` returns `[]`, so `run` is never called), not run.
- Suggestion: sweep once after `git merge` when no step ran, with `git merge` as the command in the line, or refuse such a branch before `git merge` (the ticket's other option). Out: the sweep's rules.
- Status: open

## F2. A branch that adds a Git folder as a test fixture fails its checks, and a passed merge leaves main's checkout dirty

- Kind: ux
- Found by: 2026-10-29-worker-6a44e150 (worker), 2026-10-29
- Where: `packages/delivery/src/merge-sweep.ts:20`
- What: what the branch commits now counts as a step's. A tracked folder holding a `HEAD`, or a tracked symlink to a folder outside the checkout, is removed after the install. Tests that read it then fail and main is reset. When the merge passes, main's checkout lacks those tracked files, and the next `arthur merge` refuses with `main has uncommitted changes in <path>` until the owner restores or removes them. The test `what the branch itself commits counts as a step's to the sweep` shows the removal. The refusal of the next merge is read from `merge-command.ts:108`, not run.
- Suggestion: refuse such a branch before `git merge` with a line that names the path, so the owner decides before anything runs. Out: keeping such a folder in main's checkout.
- Status: open

## F3. A python3 failure on a linked target folder removes the owner's symlink, and the line names the wrong reason

- Kind: ux
- Found by: 2026-10-29-worker-6a44e150 (worker), 2026-10-29
- Where: `packages/delivery/src/merge-sweep.ts:21`, `:84`
- What: a symlink into a folder a step writes is stamped with its target's stamp, and that stamp reads the folder's extended attributes with python3. When python3 fails on one look only, the stamps differ and the symlink is removed. The line then says `a git call in that folder would run its config outside any sandbox`, not the python3 line, and AR0479's retry does not run for it, because the link's stamp does not start with `python3 failed`. The result is safe: the link goes. Read from the code, not run.
- Suggestion: retry and word a symlink's target stamp as `.git` folders are retried and worded (AR0479). Out: the rules of what is judged.
- Status: open
