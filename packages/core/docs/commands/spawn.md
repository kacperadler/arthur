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
- The job record `<home>/jobs/<id>/`, one file per key: `task`, `kind`, `model`, `thinking`, `timeout` (minutes), `budget` (USD), `branch`, `root` (the repository), `worktree`, `project`, `prompt` (the role's prompt). An empty `branch`, `model` or `thinking` means none. Timeout and budget are the kind's own, else `core.jobs.timeoutMinutes` and `core.jobs.budgetUsd`. The record appears whole: it is written under `.<id>` and renamed.
- Then each plugin's `prepare` step runs in the worktree (a hook to install, a file to place), and the event `job-started` is emitted with the job's `id`, `kind`, `project`, `root`, `branch`, `worktree` and `tickets` (the `Ticket:` files of the task).
- A worker's `job-started` moves each ticket its `Ticket:` files lie in (`spec/features/<id>-<slug>/...`) to `in-progress` on the board (see `arthur ticket --help`). A move the board refuses (a ticket still in `planning`, a merged or dropped one, one not on the board, no project list) does not stop the job: it is printed as `plugin core: handler of job-started (event <n>) failed: <reasons>`. Other kinds move no ticket.

Refused, before any worktree or record exists (exit code 1, the reason after `arthur spawn: `):

- An unknown kind: `unknown kind <name>; kinds: <registered kinds>`.
- A kind whose role no plugin registered, or whose role file is missing: `role <role> is not registered; roles: <roles>`, `role <role>: its role file <path> is missing`.
- An empty task: `the task is empty`.
- A worker in a repository with a branch named `arthur`, where Git cannot create `arthur/<id>`: `<repository> has a branch named arthur, so Git cannot create a worker's branch arthur/<id> beside it; rename it: git branch -m arthur <new-name>`. A read-only kind is not refused.
- A `Ticket: <path>` in the task whose file is not in HEAD, for example a ticket not committed yet: `Ticket: <paths>: no such file at HEAD (<commit>); commit it first`. Each `Ticket:` the task names is checked; the path ends at a space, and a closing `.`, `,`, `;`, `:`, `!`, `?` or `)` is not part of it.
- A plugin's `beforeSpawn` check that gives a reason: `refused by <plugin>: <reason>`; one that throws: `plugin <plugin>: beforeSpawn failed: <message>`.
- A project that is not the main one: `unknown project <name>; the only project is <name>`.
- A folder outside Git, or a repository with no commit yet.
- A config or a plugin that does not load: `arthur.config.ts did not load:`, then the reasons.

A `prepare` step that throws ends the spawn with `plugin <plugin>: prepare failed: <message>; the job's worktree and record were removed`: the worktree, its branch and the record are gone, and no `job-started` is emitted. The prompt's refusals end it the same way, before any `prepare`: an override or criteria file of the project that is a symlink, lies under one, or is not a plain file, which is never read (`<path> is a symlink; refused, the roles read a project's file only as a plain file; ...`), and a plugin's prompt section that is not text.

Wrong usage (no task, more than one, an unknown flag, a flag without a value or given twice) prints the usage line and exits 2. Exit code 0 when the job was made.

It makes the job and prints its id; it starts no agent yet.
