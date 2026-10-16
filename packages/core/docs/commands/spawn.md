# arthur spawn

Usage: `arthur spawn <task> [--kind <name>] [--model <model>] [--thinking <level>]`

Starts a job on the task, given as one quoted argument, and prints its id, `<date>-<kind>-<8 hex digits>` (the date in `core.timeZone`), for example `2026-10-16-worker-b046ca2a`. The job starts from HEAD of the repository that holds `arthur.config.ts`; uncommitted changes there stay where they are and are not in the job.

- `--kind`: the kind of job, default `worker`. The core owns `worker`; plugins register the others (review, audit, plan, ...).
- `--model`, `--thinking`: the agent's model and thinking level; left out, the role's (`arthur roles`), else the agent's own default.
- `--project <name>`: the project; until a plugin adds projects, the only one is the main repository, named by its folder.

What it makes:

- A worker: the branch `arthur/<id>` and its worktree from HEAD. A read-only kind: a detached checkout of HEAD, no branch. Either lives in `.arthur-worktrees/<id>` in the folder that holds the repository, outside the main checkout and the home folder.
- `node_modules` of the main checkout is copied into the worktree when the main checkout's `package-lock.json` is the job's byte for byte (a copy-on-write clone where the filesystem has one; links are kept as they are). A different or missing lockfile: no copy.
- The prompt of the kind's role, built from the role file, the project's override and criteria files in the worktree, and the sections plugins add; `arthur roles --help` says what goes in and in which order. A criteria file the project lacks, or an empty one, is a warning on stderr, `warning: <text>`, and the job starts.
- The job record `<home>/jobs/<id>/`, one file per key: `task`, `kind`, `model`, `thinking`, `timeout` (minutes), `budget` (USD), `branch`, `root` (the repository), `base` (the commit it starts from), `worktree`, `project`, `prompt` (the role's prompt). An empty `branch`, `model` or `thinking` means none. Timeout and budget are the kind's own, else `core.jobs.timeoutMinutes` and `core.jobs.budgetUsd`. The record appears whole: it is written under `.<id>` and renamed.
- Then each plugin's `prepare` step runs in the worktree (a hook to install, a file to place), the event `job-started` is emitted with the job's `id`, `kind`, `project`, `root`, `branch`, `worktree` and `tickets` (the `Ticket:` files of the task), and the job's wrapper starts in the background. `arthur spawn` prints the id and returns without waiting for the agent.
- A worker's `job-started` moves each ticket its `Ticket:` files lie in (`spec/features/<id>-<slug>/...`) to `in-progress` on the board (see `arthur ticket --help`). A move the board refuses then, for a ticket changed after the spawn's check below, does not stop the job: it is printed as `plugin core: handler of job-started (event <n>) failed: <reasons>`. Other kinds move no ticket.

Refused, before any worktree or record exists (exit code 1, the reason after `arthur spawn: `):

- An unknown kind: `unknown kind <name>; kinds: <registered kinds>`.
- A kind whose role no plugin registered, or whose role file is missing: `role <role> is not registered; roles: <roles>`, `role <role>: its role file <path> is missing`.
- An empty task: `the task is empty`.
- A worker in a repository with a branch named `arthur`, where Git cannot create `arthur/<id>`: `<repository> has a branch named arthur, so Git cannot create a worker's branch arthur/<id> beside it; rename it: git branch -m arthur <new-name>`. A read-only kind is not refused.
- A `Ticket: <path>` in the task whose file is not in HEAD, for example a ticket not committed yet: `Ticket: <paths>: no such file at HEAD (<commit>); commit it first`. Each `Ticket:` the task names is checked; the path ends at a space, and a closing `.`, `,`, `;`, `:`, `!`, `?` or `)` is not part of it.
- A plugin's `beforeSpawn` check that gives a reason: `refused by <plugin>: <reason>`; one that throws: `plugin <plugin>: beforeSpawn failed: <message>`.
- A worker whose `Ticket:` files lie in a ticket (`spec/features/<id>-<slug>/...`) that cannot move to `in-progress`: one in `planning`, not approved yet, a `merged` or `dropped` one, or one not on the board: `refused by core: <id> is <status>, which cannot move to in-progress` or `refused by core: <id> is not on the board`, one per ticket joined by `; `, then `; a worker starts on a ticket that is planned, in-progress, review, done`. Without a project list the board cannot be read: `plugin core: beforeSpawn failed: no project list: ...`. Other kinds are not checked.
- A project that is not the main one: `unknown project <name>; the only project is <name>`.
- A folder outside Git, or a repository with no commit yet.
- A config or a plugin that does not load: `arthur.config.ts did not load:`, then the reasons.

A `prepare` step that throws ends the spawn with `plugin <plugin>: prepare failed: <message>; the job's worktree and record were removed`: the worktree, its branch and the record are gone, and no `job-started` is emitted. The prompt's refusals end it the same way, before any `prepare`: an override or criteria file of the project that is a symlink, lies under one, or is not a plain file, which is never read (`<path> is a symlink; refused, the roles read a project's file only as a plain file; ...`), and a plugin's prompt section that is not text.

Wrong usage (no task, more than one, an unknown flag, a flag without a value or given twice) prints the usage line and exits 2. Exit code 0 when the job was made.

The wrapper, one background process per job in a process group of its own, starts the agent, `core.agent.command` (default `omp`), in the worktree: `<agent> -p --mode json --auto-approve --tools <tools> --append-system-prompt <record>/prompt [--model <model>] [--thinking <level>] @<record>/task`. A kind with a branch, such as `worker`, gets the tools `read,edit,write,bash,grep,glob`; a read-only kind `read,bash,grep,glob`. From what the agent prints the wrapper adds to the record, `log` appended to, every other file written whole under a temporary name and renamed:

- `pid`: the wrapper's process id, which is the job's process group; then `state`: `running`.
- `log`: lines `[arthur <time>] ...` of the wrapper's own (the agent's command line, the end), one line per tool call (`<tool> <path, command or pattern>`), what the agent prints on stderr, and any line of its stdout that is not an event.
- `cost`: the USD the agent's messages report, summed, with 4 decimals; `tool-calls`: how many it started; `activity`: `tool` while a tool call runs, `think` otherwise.
- `checks`: one line per run of the project's own checks, for the `check` and `test` scripts of the worktree's `package.json`: `check pass|fail` for `npm run check` (a TypeScript error in its output fails it), `test pass|fail <passed>/<total>` for `npm test` from node --test's summary (`test pass|fail` without one), and `stale` after the first edit or write that follows them.
- At the end, every file above with its final value and `result` (the text of the agent's last message that had text, empty when none) and `commits` (a worker's commits since `base`, `git log --oneline`; empty for a read-only kind), then `state` last: `done`, or `failed`. A reader that sees `done` or `failed` can trust every other file.

The state is `done` when the agent exited 0 with a final message; otherwise `failed`, and the reason, the last line of `log` (`failed: <reason>`), says why: `the agent did not start: <error>`, `the agent was killed by <signal>`, `the agent stopped on error: <text>` or `on aborted` (the last message's stop), `the agent exited <code>`, `the agent ended without a final message`. Then the event `job-ended` is emitted with `id`, `kind`, `project`, `state` and `reason`.

A record deleted while the job runs is noticed at the wrapper's next write: it sends SIGTERM to the job's process group, so the agent and every process it started stop (one that left the group does not), writes the one line `[arthur <time>] job <id>: its record <path> was deleted while it ran; the agent was stopped and nothing more is written` to `<home>/wrapper.log`, and ends; nothing more goes into the record's folder and no `job-ended` is emitted. `<home>/wrapper.log` also holds whatever a wrapper prints that has no record to go to, such as a crash.
