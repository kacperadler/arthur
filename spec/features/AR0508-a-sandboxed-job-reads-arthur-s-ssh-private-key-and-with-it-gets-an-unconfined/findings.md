# AR0508 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A job that empties its record's `guarded` file reads the env file after `arthur continue`

- Kind: security
- Found by: 2026-10-27-worker-6355f513 (worker), 2026-10-27
- Where: `packages/core/src/job-sandbox.ts:79-82` (`hidden` reads the env file's path from the record), `packages/core/src/wrapper.ts:122` (read once per wrapper, so anew at each continue), `packages/core/src/job-sandbox.ts:67-75` (`writable`: the record is writable)
- What: the record is writable to the agent's sandbox, so any program the job runs can run `: > "$ARTHUR_JOB/guarded"`. The next wrapper, started by `arthur continue`, reads an empty list and hides no env file, so the continued run reads every token in it. Reproduced: an agent script that runs `{ cat <env file> || echo refused; } >> env-read 2>&1; : > "$ARTHUR_JOB/guarded"` in the AR0508 test of `packages/core/test/sandbox.test.ts`, across `jobs.continue`, wrote `Permission denied\nrefused\n` in the first run and `ARTHUR_SECRET_TOKEN=s3cret-t0ken` in the second. The same empty list also stops the worktree guard from naming any guarded place (it reads `jobPlace(record)` on each call); the sandbox still refuses those writes. `~/.ssh` is not affected: `hidden` takes it from the user's home, not from the record (AR0508).
- Suggestion: give the wrapper the env file's path from outside the record (the runner knows `core.envFile`; on another machine there is none), or keep `guarded` where the job's sandbox cannot write it, and add the continue case to the test above. Out: the network.
- Status: open

## F2. Credentials outside `~/.ssh` and the env file still reach origin from a job

- Kind: security
- Found by: 2026-10-27-worker-6355f513 (worker), 2026-10-27
- Where: `packages/core/src/job-sandbox.ts:79-82` (`hidden`), `docs/deploy.md:44`
- What: the sandbox hides only the env file and `~/.ssh` [INFERENCE from the code: every other file is granted a read]. A Git credential kept elsewhere, `~/.git-credentials` (Git's `store` helper), `gh`'s token in `~/.config/gh/hosts.yml`, or a key an `IdentityFile` in `~/.ssh/config` names outside `~/.ssh`, is still readable, so a job holding one can `git push` to origin over HTTPS past `arthur merge`, as AR0508 describes for an SSH key. `docs/deploy.md` now names these as still readable.
- Suggestion: hide the known credential stores as well (`~/.git-credentials`, `$XDG_CONFIG_HOME/git/credentials`, `~/.config/gh`), or tell in `docs/setup.md` to keep no such credential for Arthur's user; a test per store as the AR0508 one. Out: the network.
- Status: open
