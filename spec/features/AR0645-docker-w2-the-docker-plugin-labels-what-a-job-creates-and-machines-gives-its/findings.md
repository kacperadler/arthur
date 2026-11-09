# AR0645 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. In a sandboxed job, bash cannot run the job's docker script and stops; sh and node fall through unlabelled

- Kind: fix
- Found by: 2026-11-09-worker-69fae305 (worker), 2026-11-09
- Where: `packages/docker/src/docker-prepare.ts:36`, `packages/core/src/job-sandbox.ts:104` (`hidden`)
- What: the plan (AR0604, Risks: "The script folder may be unreadable in a sandboxed job ... W2 tests it. If it does not fall through, the script folder must be readable by the job") left this to W2. It does not fall through in bash. A job spawned through the fake host with the docker plugin's prepare, on this Linux machine where the Landlock sandbox runs, its `omp` running `sh -c 'docker run img'` and `bash -c 'docker run img'`: sh ran the next `docker` on PATH, unlabelled (the fake docker noted `["run","img"]`), and bash printed `bash: line 1: <home>/docker/jobs/<id>/docker: Permission denied`, exit 126. Landlock checks READ_FILE on the open of an exec, and Arthur's home is hidden from the job, so bash's PATH lookup finds the script by `stat` and its `execve` fails. So in such a job every `docker` command run by bash fails, those that need no daemon too (`docker --version`, `docker compose config`). The sandbox already keeps the job from Docker's daemon (no stream Unix socket), so labels cannot act there either, as the approved Option 1 says.
- Suggestion: one of (a) the job's sandbox shows `<home>/docker/jobs/<id>` to the job, as it shows its own record: a sandbox change, which this ticket's Scope leaves out; (b) the prepare adds the script only where the job runs unsandboxed, which needs the core to say so to a plugin (a host API change not approved) or the plugin to repeat the core's Landlock probe; (c) accept it, documented in docs/docker.md as now. The owner decides; nothing of the sandbox changes here.
- Status: open
