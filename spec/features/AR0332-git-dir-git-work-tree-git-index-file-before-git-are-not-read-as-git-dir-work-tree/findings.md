# AR0332 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. `env -C <dir>` and `sudo -D <dir>` before a command are not read as a `cd`

- Kind: security
- Found by: 2026-10-25-worker-10b542de (worker), 2026-10-25
- Where: `packages/core/src/worktree-guard.ts:50-57` (`commandIndex` skips `-C`/`-D` with their value), `packages/core/src/worktree-guard.ts:142` (`dir` starts from `cwd` and only the `git -C` folders)
- What: `env -C ../../acme git checkout -- .` runs git in the main checkout, as `git -C ../../acme checkout -- .` does, which the guard refuses; the wrapper's folder is skipped as an option value and the command is judged from the job's `cwd`. `gitCall(["commit", "-m", "x"], ["env", "-C", "/x"]).chdirs` is `[]` (run with `node -e`); that the whole call then passes is an inference from those lines, not run. The same holds for `rm`, `mv` and the other writing commands after `env -C`/`env --chdir=`/`sudo -D`.
- Suggestion: in `judge`, resolve the folder of `env -C`/`--chdir` and `sudo -D`/`--chdir` among the words before the command and judge the command from there; a test with `env -C <main> git checkout -- .` and `env -C <main> rm README.md` refused.
- Status: open
