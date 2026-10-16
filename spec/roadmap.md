# Roadmap

The ordered list of feature tickets that builds Arthur from the core to the plugins (`spec/vision.md`). The coordinator creates one ticket per entry, in this order, and starts an entry once everything in its "Depends on" is merged. Each entry is half a day to a day of agent work.

How to read an entry:

- Package: where the code lives. `packages/core/` is `@arthur/core`; a plugin is `packages/<plugin>/`, `@arthur/<plugin>`.
- Delivers: what it adds, and through which interface (a command, an event, the host API, an option).
- Done means: what a reviewer checks, edge cases included. Every entry also means: its tests run under `npm test` against fakes (the core against a fake plugin and a fake agent, a plugin against the fake host of `@arthur/core/testing`), `npm run check` and `npm test` pass, each command it adds has its doc page, each option it adds is in `arthur.config.example.ts`.
- Covers: the capabilities of the harness Arthur replaces that it carries over, by their id in the table at the end.

Order: the core first, piece by piece, then the first-version plugins in the vision's order, then the later plugins. Within the core the event stream comes right after the plugin host, because the job runner and the board emit into it from their first line. The plugin API is frozen (entry 42) only after schedule, youtrack and telegram use it. An entry that needs a plugin built later sits after that plugin (the morning report, the auto-merge).

The host API, as these entries build it (names are proposals; entry 42 fixes them): a plugin is a function from its options to `{ name, requires, setup(host), start?(), stop?() }`. `setup` registers; `start` runs long-lived work and is called only by `arthur run`. The host gives a plugin its options with every `...Env` name resolved, its own folder `.arthur/<plugin>/`, `events` (`on`, `emit`), `commands` (`register`), `jobs` (`registerKind`, `spawn`, `beforeSpawn`, `prepare`), `board`, `clock`, `projects()`, and `provide(name, fn)` / `call(name, ...)` / `collect(name)`, through which plugins reach each other without importing each other.

## Core

### 1. Repository rules as a test

- Package: repository root, `test/structure.test.ts`, added to `npm test`.
- Delivers: the rules that keep Arthur small, as a test: no runtime dependency in any `package.json`; no `index.ts`, `types.ts`, `utils.ts`; no `class` or `enum`; every source file at most 200 lines; a line budget per package (the numbers live in this test only); a plugin imports no other `@arthur/<plugin>` and no path outside its own package except `@arthur/core` and its published subpaths; the core imports no plugin; every package has at least one test.
- Done means: each rule fails on a fixture tree that breaks it (one fixture per rule) and passes on the repository; the message names the file and the rule. Edge cases: an import of `@arthur/core/src/...` (a core internal) is refused, `@arthur/core/testing` is allowed; a type-only import of another plugin is refused too; a file of exactly 200 lines passes, 201 fails.
- Depends on: none.
- Size: half a day.
- Covers: E3.

### 2. Config: `defineConfig` and the core's options

- Package: core.
- Delivers: `defineConfig` and the config type, exported by `@arthur/core`; `loadConfig(path)`, which imports `arthur.config.ts` with Node and checks the core's own options (`home`, `envFile`, `agent.command`, `timeZone`, `quietHours`, `jobs.timeoutMinutes`, `jobs.budgetUsd`, `jobs.cpu`, `jobs.memory`) and applies their defaults.
- Done means: a valid config loads with defaults filled. Refused, each naming the option's path and what was expected: an unknown option, a wrong type, an unknown time zone, a `quietHours` time that is not `HH:MM`, a negative budget or timeout. A missing config file names the path looked at; a config file that throws names the file and its error. Budget `0` means no limit and is accepted.
- Depends on: 1.
- Size: half a day.
- Covers: R13 (the settings it replaces), the core part of the settings table.

### 3. Config: env names, `.env`, and `arthur config check`

- Package: core.
- Delivers: resolution of every option ending in `Env`: the value comes from the shell, else from `envFile` (`KEY=value`, comments, quotes); a shell variable wins even when empty. Variable names must be `ARTHUR_<PLUGIN>_<WHAT>` or, for a named instance, `ARTHUR_<PLUGIN>_<INSTANCE>_<WHAT>`. The command `arthur config check` lists every variable the enabled plugins need, each `set` or `missing`, never its value.
- Done means: a missing required variable refuses the start, naming the option and the variable; a disabled plugin's variables are not read and not listed; a value never appears in an error, a log line or the check's output (asserted with a known secret). Edge cases: an empty shell variable over a `.env` value; a `.env` line without `=`; a duplicate key (the last wins, said once); a name without the `ARTHUR_` prefix or with another plugin's name is refused; `.env` missing is fine when every variable is in the shell.
- Depends on: 2.
- Size: half a day to a day.
- Covers: R13, C9, G4 (config part).

### 4. Plugin host, and the fake host

- Package: core; the fake host is exported as `@arthur/core/testing`.
- Delivers: the plugin shape and the host that loads the config's plugin list: each plugin checks its own options (the host refuses on its error, naming plugin and option path); `enabled: false` is not loaded and its env is not read; `requires` is checked; `orchestration` is required and `enabled: false` on it is refused; `setup` runs in dependency order; `provide` / `call` / `collect` between plugins; each plugin's folder `.arthur/<plugin>/`. The fake host records what a plugin registers and emits and lets a test drive it. The test kit's safety net: no test can reach a live `.arthur/`, socket or bot (variables cleared, temporary folders removed after the run).
- Done means: tested against fake plugins. Refused, each naming the plugins involved: a missing `orchestration`, `enabled: false` on it, a missing required plugin, a cycle in `requires`, two plugins with one name, a `call` to a name nobody provides. Edge cases: a plugin whose `setup` throws stops the load and names the plugin; `collect` with no provider returns empty; a disabled plugin that others require is refused like a missing one.
- Depends on: 3.
- Size: a day.
- Covers: R18 (dropped: the host loads plugins), E2 (fake host, safety net, temporary folders).

### 5. Event stream

- Package: core.
- Delivers: `host.events.on(name, fn)` and `emit(name, data)`, and the append-only log `.arthur/events.jsonl`: one line per event with a sequence number, the time and the plugin that emitted it; `readEvents(fromSeq)` for a later reader.
- Done means: subscribers get events in emit order; an event emitted inside a handler is delivered after the current one; a handler that throws does not stop the others and is logged with the plugin's name. Edge cases: two processes appending at once (the daemon and a command) never interleave a line; a torn last line after a crash is skipped on read and the next sequence number continues after it; reading from a sequence past the end returns nothing.
- Depends on: 4.
- Size: half a day to a day.
- Covers: the vision's event stream (no predecessor capability: it is new).

### 6. Command registry and the `arthur` CLI

- Package: core.
- Delivers: `host.commands.register({ name, doc, run, phone? })`; the `arthur` binary: `arthur <cmd> [args]`, `arthur <cmd> --help` and `arthur help <cmd>` print the doc file, `--project <name>` acts on another project; `route("/name text")` for channels: the reply of a phone command, or a line naming the unknown command; the list of phone commands for a channel's menu.
- Done means: a command runs with its arguments and exit code. Refused at load: a command without its doc file, two plugins registering one name. Edge cases: an unknown command prints the list; `--help` on a command whose doc file was deleted after load says so; a phone command that throws replies with one error line, not a stack; `/name` with no text; a command name differing only in case is a different command, not a match.
- Depends on: 4.
- Size: a day.
- Covers: R1, R19, G3, G9.

### 7. Clock: time zone and quiet hours

- Package: core.
- Delivers: `host.clock`: now in `timeZone`, `isQuiet(at)` from `quietHours`, `next("HH:MM", days?)` for timers; a settable clock in the fake host.
- Done means: tested in `Europe/Warsaw` and one zone without daylight saving. Edge cases: quiet hours across midnight (22:00 to 07:30) and within a day; `from` equal to `to` means never quiet; the spring gap (02:30 does not exist: the next valid minute) and the autumn repeat (02:30 fires once); `next` at exactly the slot's minute; a day list with one day.
- Depends on: 4.
- Size: half a day.
- Covers: G4.

### 8. `arthur run`: Arthur as a process

- Package: core; `docs/deploy.md`.
- Delivers: `arthur run` loads the config, sets up every plugin, calls `start` in dependency order, and on SIGTERM calls `stop` in reverse; one process per home folder (a pid lock taken over from a dead pid). `docs/deploy.md`: install Node, git, tmux and OMP on a VPS, the systemd user service that keeps `arthur run` alive (started again after it dies, the user manager too), `.env`, the threat model, daily use, updating.
- Done means: a second `arthur run` on the same home refuses, naming the pid; a stale lock of a dead pid is taken over; a plugin whose `start` throws stops the others already started, in reverse, and the process exits non-zero naming the plugin; SIGTERM during `start` still stops what started.
- Depends on: 4, 5.
- Size: half a day to a day.
- Covers: S7 (the restart of the service and of the user manager), S8, C4 (the core's units), C8 (the home folder).

### 9. Job runner: spawn and the job record

- Package: core.
- Delivers: `arthur spawn <task>` and `host.jobs.spawn`: a worker job on its own branch and worktree from HEAD, or a read-only kind in a detached checkout; `host.jobs.registerKind({ name, readOnly, role, budgetUsd?, timeoutMinutes? })` so a plugin owns its kinds; `host.jobs.beforeSpawn(check)` so a plugin can refuse a spawn with a reason; `host.jobs.prepare(fn)`, run after the worktree exists and before the agent starts (a hook to install, a file to place); the job record `.arthur/jobs/<id>/` (task, kind, model, thinking, timeout, budget, branch, root, worktree, project); every `Ticket:` file the task names must exist in the worktree; `node_modules` copied when the lockfile is the same; the id returned in about a second; `job-started` emitted.
- Done means: tested with real Git in a temporary repository. Refused before any record or worktree exists: an unknown kind, a missing `Ticket:` file (named), a `beforeSpawn` refusal (its reason printed). A `prepare` that throws removes the worktree and the record and names the plugin. Edge cases: a lockfile that differs (no copy); a repository with uncommitted changes (the job starts from HEAD, the changes stay); two spawns at once get distinct ids and branches; a branch name that exists already.
- Depends on: 5, 6.
- Size: a day.
- Covers: R2, R11, B6 (the `Ticket:` part).

### 10. Prompt loader and `arthur roles`

- Package: core; the worker role file ships with the core.
- Delivers: the prompt of a job's role: the role file the kind's plugin ships, then a project's own override, then each criteria file present as `## <title> (<path>)`, then the sections other plugins add for that role and project through `collect("prompt")` (commit rules, a tracker's rules); the worker role (how a worker works, its Never list, its final message), in English; `arthur roles` prints which file each role reads and its model.
- Done means: a missing role file refuses the spawn, naming the file; a missing criteria file warns and the job starts; a symlinked override or criteria file is never read (refused with its path). Edge cases: an empty criteria file; an override that exists for one role only; a project without a criteria folder.
- Depends on: 9.
- Size: half a day to a day.
- Covers: R14, R15, E5, G8 (the loading part).

### 11. Job runner: the wrapper, and the fake agent

- Package: core; the fake agent is exported by `@arthur/core/testing`.
- Delivers: one background process per job that starts `omp` with the role's tools (a worker gets edit and write; every other kind is read-only), model, thinking level and prompt; writes `state`, `pid`, `log`, `result`, `cost`, `tool-calls`, `activity`, `checks`, `commits`, with `state` last; emits `job-ended` with the state. The fake agent is a script on `PATH` that plays a scripted run (tool calls, cost, final message, exit code).
- Done means: a finished, a failed and a crashed agent each leave a record a reader can trust once `state` is final. Edge cases: an agent that prints no final message; an agent killed by a signal; a log line longer than a pipe buffer; a job record deleted while running (the wrapper ends with one line, nothing else written).
- Depends on: 10.
- Size: a day.
- Covers: R3, E2 (fake agent).

### 12. Job limits: time and budget

- Package: core.
- Delivers: `jobs.timeoutMinutes` and `jobs.budgetUsd` from the config, per-kind defaults from `registerKind`, `--timeout` and `--budget` on spawn; a job past its limit is stopped and its state says which limit; a kind may ask for one automatic resume with the budget doubled.
- Done means: edge cases: budget `0` is no limit; a cost exactly at the budget stops, one cent below does not; a timeout during a long tool call; the automatic resume happens once, never twice, and only for kinds that ask for it.
- Depends on: 11.
- Size: half a day.
- Covers: R4, the job settings of the settings table.

### 13. Job limits: one scope per job in a joint slice

- Package: core.
- Delivers: each job in its own systemd scope inside one slice with the joint `jobs.cpu` and `jobs.memory` limit, so jobs cannot starve the coordinator; every process a job leaves behind is killed at its end; where there is no user manager (macOS, a container) the job runs bare with one log line saying so.
- Done means: tested with a test slice name, never the production one, and removed after the run. Edge cases: `cpu` undefined means host cores minus one; a `memory` value systemd refuses is refused at config load; a job that forks a daemon leaves nothing running after it ends; no user manager.
- Depends on: 11.
- Size: half a day to a day.
- Covers: R5, G7 (joint limit), S7 (the delegation drop-in).

### 14. Stop, continue, steer

- Package: core.
- Delivers: `arthur stop <id>` (SIGTERM to the job's group, SIGKILL after a grace, then strays that left the group, then the rest of its scope); `arthur continue <id> <instruction>` resumes a finished worker in place (same id, branch, worktree, agent session), `--budget` replaces the old one; `arthur steer <id> <text>` gives a running worker one correction after its next tool call.
- Done means: refused, each with the id and the reason: stopping a finished job, continuing a running job or a read-only kind, steering a job that is not running. Edge cases: a job that ignores SIGTERM; a stray that left the group; a steer still undelivered when the job ends is moved aside and named in `job-ended`; two steers before the next tool call arrive in order.
- Depends on: 11, 13.
- Size: a day.
- Covers: R6, R7, R8.

### 15. Jobs list, prune, dead jobs, and their phone commands

- Package: core.
- Delivers: `arthur jobs` (every project's jobs, grouped like the board, one line each, the short id); `arthur prune` frees the worktree, branch and record of finished jobs, Git deciding what is safe, and keeps a record a plugin asks to keep; a sweep that fails a job whose wrapper and group are gone on two sweeps in a row with `process gone`; phone commands `/jobs`, `/steer <id> <text>`, `/stopall` (stops every running job of every project, one line each, and emits `stop-all`).
- Done means: edge cases: a branch with unmerged commits is not deleted (Git's refusal is reported in one line); a job gone on one sweep only is not failed; `/stopall` with nothing running says so; a short id that matches two jobs is refused with both.
- Depends on: 14.
- Size: a day.
- Covers: R9, R10, R12, G7, T6, T13, T14.

### 16. Ticket board: tickets and the board file

- Package: core; the ticket templates ship with the core.
- Delivers: tickets as folders `spec/features/<id>-<slug>/` (`ticket.md`, `findings.md`, `review-N.md`, `outcome.md` from templates); the board `spec/build.json` of each project, changed only through `arthur ticket`; ids are the project's prefix and a number, from 1; statuses planning, planned, in-progress, review, done, merged, dropped; one writer at a time (a lock taken over from a dead pid); `ticket-created` and `ticket-moved` events; `host.board` for plugins.
- Done means: `planned` is refused while template guidance is left in the ticket. Edge cases: two writers at once never lose a change; a lock of a dead pid is taken over; a hand-broken board file is refused, naming the file, never overwritten; ids continue after a dropped ticket; an empty board.
- Depends on: 5, 6.
- Size: a day.
- Covers: B1, B2, B3 (the prefix), B12, G11, G13 (the prefix's use).

### 17. Ticket board: transitions, `after`, the digest, and the board's phone commands

- Package: core.
- Delivers: the allowed status transitions, statuses that follow jobs (`job-started` of a worker sets in-progress), merged and dropped final; `arthur ticket after <id> <ids>` (a ticket waits for others); the board digest (every open ticket, the 10 newest merged, one line for the rest); phone commands `/board [PREFIX] [all]`, `/task <id>`, `/findings <id>`, the id given as `14`, `AR14` or the full id.
- Done means: refused: a transition the table does not allow, an `after` that makes a cycle, names an unknown or a dropped id. Edge cases: a merged ticket never moves back; the full board when it fits one message, else the digest; `/findings` of a ticket without the file; an id with another project's prefix.
- Depends on: 16, 9.
- Size: a day.
- Covers: B4, B5, B11, T7, T9.

### 18. Env guard

- Package: core; an OMP extension loaded in every job and in the coordinator.
- Delivers: a tool call that names a secrets file (`.env`, not `.env.example`) is refused, down to quoting, expansion and options that carry the name; one `sed -i` that sets a key without printing is allowed.
- Done means: a table of calls, each refused or allowed, and each refusal names the file. Edge cases: `cat .e''nv`, `cat "$HOME/x/.env"`, `--env-file=.env`, a glob that matches `.env`, `.env.example`, `.envrc`, a path `.env/` that is a folder.
- Depends on: 11.
- Size: half a day to a day.
- Covers: R16.

### 19. Worktree guard and its shell parser

- Package: core; an OMP extension loaded in every job.
- Delivers: in every job, a file tool or bash command that writes into the main checkout, the home folder `.arthur/`, or another job's worktree is refused: redirects, writing commands, `git` writes, `cd` there, symlinks, `git stash`. Reading passes. The shell parser is its own file, shared with the env guard.
- Done means: a table of commands, each refused or allowed. Edge cases: a relative path that climbs out of the worktree; a symlink inside the worktree that points out of it; `cd` into the main checkout followed by a write; a heredoc; a write into the job's own worktree passes.
- Depends on: 18.
- Size: a day.
- Covers: R17, G2.

## Orchestration (required)

### 20. The coordinator's process and `arthur attach`

- Package: orchestration.
- Delivers: the plugin, required; its options (`maxAgents`, `coordinator`, `roles`, `plan`, `autopilot`, `morningReport`) checked; one interactive `omp` in its own tmux session (`coordinator.tmux`), with `--continue` and the coordinator's model and thinking; started again `restartDelaySeconds` after it ends for any reason; a start waits up to `exitWaitSeconds` for the previous `omp` to exit, so two never refresh the agent's credential at once; `arthur attach`; `arthur coordinator stop`, refused while any job runs; the coordinator's role file, in English.
- Done means: tested with the fake agent and a tmux socket in the test's folder. Edge cases: the previous `omp` still alive after the wait (the start is refused and logged, then retried); the coordinator crashing in a loop does not spin faster than the delay; `attach` with no session says so.
- Depends on: 8, 10, 15.
- Size: a day.
- Covers: S1, O1, the coordinator's settings and the session options it owns.

### 21. The coordinator's inbox and the wake on job end

- Package: orchestration; an OMP extension in the coordinator's session.
- Delivers: messages for the coordinator (`message-received` from a channel, a schedule action, a job's end) are queued and delivered as turns, in order, once the session is idle; each finished turn is emitted as `coordinator-replied`; one wake message per sweep for the jobs that ended (state, the first 15 lines of the result, the procedure the kind's plugin names, the project when it is not the main one), claimed only after it was delivered; a footer while jobs run.
- Done means: edge cases: two jobs ending in one sweep make one message; a failed delivery is retried and the third failure is told; a message arriving mid-turn waits; nothing is lost or delivered twice across a coordinator restart.
- Depends on: 20.
- Size: a day.
- Covers: O3.

### 22. The coordinator's context on every turn

- Package: orchestration.
- Delivers: on every turn the coordinator reads its role, each project's vision, the styleguide, a warning per missing criteria file, the board digest, the local time and whether it is night (from `host.clock`), and the lines other plugins add through `collect("coordinator.context")` (session: restart due; manage: retro due).
- Done means: edge cases: a project without a vision file gets a warning line, not a failure; a contributing plugin that throws costs its line only, named; quiet hours across midnight.
- Depends on: 21, 17, 7.
- Size: half a day.
- Covers: O2.

### 23. `maxAgents` and the models of each role

- Package: orchestration.
- Delivers: `maxAgents` enforced through `beforeSpawn` across all projects, for every spawn, the human's included; the model and thinking level of each role and the quick model from `roles`; `--model` on a spawn wins.
- Done means: refused: a spawn when `maxAgents` jobs run (the message names them); an invalid thinking level, before any job record exists. Edge cases: `maxAgents` of 1; a job ending frees its slot at once; a role without a model uses the agent's default.
- Depends on: 20.
- Size: half a day.
- Covers: O12, O13, the model settings.

### 24. Planning of large tickets

- Package: orchestration.
- Delivers: `- Plan: yes` under a ticket's Goal; the kinds `plan` (read-only planner) and `plan-review`; `arthur ticket file` of a plan (replaces `plan.md`, history in Git) and of a plan review (`plan-review-N.md`); a worker on such a ticket needs its approved `plan.md`; the plan budget option; the procedure sent when a plan or plan review ends; the phone command `/plan <id>`.
- Done means: refused: a worker spawn on a plan ticket without an approved plan; filing a failed plan job. Edge cases: re-planning keeps one `plan.md`; plan review numbers continue; `/plan` of a ticket without a plan.
- Depends on: 22, 17.
- Size: a day.
- Covers: O9, O14, B6 (the plan part), B9, T10, G5.

### 25. Autopilot

- Package: orchestration.
- Delivers: `arthur ticket status <id> planned --autopilot`: pre-approval of a ticket from an audit or a finding, kind bug or cleanup, at most 3 Scope files, none on delivery's always-review list (asked through `call`), a budget above 0 and at most the cap; records `Pre-approved by policy`; the autopilot criteria file.
- Done means: refused, each naming the rule broken: a feature ticket, 4 Scope files, a file on the always-review list, budget 0, a budget over the cap. Edge cases: exactly 3 files; the always-review list not provided (delivery off) refuses rather than passes.
- Depends on: 24.
- Size: half a day.
- Covers: B10, the autopilot settings.

## Session

### 26. Compaction during the day

- Package: session.
- Delivers: at each `compactAt` time in `timeZone`, the coordinator's conversation is compacted with the agent's own compaction, once the session is idle with nothing queued; after `compactWaitSeconds` the request is withdrawn with one line (`compact: skipped, session busy for N s`); nothing happens when no session runs; running jobs do not matter.
- Done means: edge cases: a slot missed while Arthur was down is skipped, not run late; two slots close together never queue two compactions; daylight saving days.
- Depends on: 21, 7.
- Size: half a day to a day.
- Covers: S2.

### 27. Fresh start, `/restart` and `/restart fresh`

- Package: session.
- Delivers: at `freshAt` a new conversation (no `--continue`), skipped while any job runs; phone commands `/restart` and `/restart fresh`, answered without the model and refused while any job runs (`error: N jobs running: …; run /stopall first`), the command's message not read again by the next coordinator; after a restart one `Restarted.` message with the steps left in `.arthur/session/after-restart.md` and the health lines collected from other plugins.
- Done means: edge cases: the fresh slot at no other hour, a missed slot not run late; `/restart` with one job running; an empty `after-restart.md` is not sent; the notice says `(fresh session)` after a fresh start.
- Depends on: 26, 20.
- Size: a day.
- Covers: S3, S4, T15, O4.

### 28. Restart guard

- Package: session.
- Delivers: the session records the main commit and start time it loaded; a merge since then that changed code the session loaded (the host knows each plugin's package folder) makes every spawn refuse with `restart due: <merge>`, through `beforeSpawn`, unless `--ignore-restart`; the coordinator's context gets a `## Restart` line; `restartGuard: false` turns it off.
- Done means: edge cases: a merge that changes only docs or tests does not count; a merge of a disabled plugin's code does not count; a restart clears it; the guard on a project other than Arthur's own does nothing.
- Depends on: 27, 22.
- Size: half a day to a day.
- Covers: S5.

### 29. Start notice and LLM probe

- Package: session.
- Delivers: at every start one word asked of the coordinator's model first; a `notice` event `coordinator up on <host>` or `no LLM access on <host>: <reason>; run omp login`; a turn that fails before any text emits `turn failed on <host>: <reason>`; `probeLlm: false` skips the probe.
- Done means: edge cases: the probe times out; the agent's error carries a credential (it is not repeated); two starts in a row send two notices, not one merged.
- Depends on: 27.
- Size: half a day.
- Covers: S6.

## Schedule

### 30. Schedule entries and the sweep

- Package: schedule.
- Delivers: entries from the config and from the `file` option: a daily `HH:MM` (optionally on some days) or a one-off date and time, in `timeZone`; an action (a message to the coordinator `[scheduled <id>] …`, optionally naming a procedure) or a job (spawn of a kind); each due slot claimed once, run state in `.arthur/schedule/`.
- Done means: edge cases: a daily entry missed for three days fires once and says it is late; a one-off in the past fires once at start; a hand-broken entry is skipped and named, the others still run; two sweeps at once claim a slot once; a day list that excludes today.
- Depends on: 21, 7.
- Size: a day.
- Covers: C1, C3.

### 31. Registered entries and `arthur schedule`

- Package: schedule.
- Delivers: `provide("schedule.register")`, through which another plugin registers its entries from its options (ids namespaced by the plugin); `arthur schedule add|list|remove` for hand-added entries in the file.
- Done means: refused: a registered id that clashes, `remove` of a registered entry (it says which plugin's option makes it), an `add` with a time that is not valid. Edge cases: `list` shows both kinds with their source; a plugin disabled after registering leaves no entry behind.
- Depends on: 30.
- Size: half a day.
- Covers: C1 (the command), C2, G6 (the mechanism).

## Projects

### 32. The project list

- Package: projects.
- Delivers: the `list` option: name, `path` or `repo` (cloned into `reposDir`), `prefix`, `tracker`, `ci`, `commitRules`, `autoMerge`, `pathPrepend`, `prompts`; `provide("projects")`, which the host serves as `host.projects()`; `pathPrepend` in front of `PATH` for the project's jobs and checks; the phone command `/projects` (prefix, folder, open tickets, running jobs).
- Done means: refused at load, naming the project: two projects with one name or prefix, both or neither of `path` and `repo`, a `tracker.instance` the tracker plugin does not have. Edge cases: a repo already cloned with another remote is refused, not overwritten; a clone that fails names the project and leaves no folder; `/projects` with a broken board gets a line for that project.
- Depends on: 6, 16.
- Size: a day.
- Covers: P2, P4, T8, B3 (where the prefix is set), G8 (the paths), G13, the `PATH` setting.

### 33. Onboarding a repository

- Package: projects.
- Delivers: `arthur init <project>` gives a project's repository what Arthur reads (the `spec/` skeleton, the criteria files, an empty board); the kind `onboarding`: reads the repository, asks up to 10 questions, then drafts the vision and criteria; the procedure sent when it ends; its merge accepts only those files.
- Done means: refused: `init` on a project not in the config, `init` over an existing board. Edge cases: an empty repository; the onboarding asking more than 10 questions is cut at 10; a draft touching another file is refused at merge.
- Depends on: 32, 10.
- Size: a day.
- Covers: P1, P3, O8.

## Commit rules

### 34. Commit rules per project

- Package: commit-rules.
- Delivers: each project's `commitRules`: a `regex` becomes a `commit-msg` hook, installed through `host.jobs.prepare` in the project's job worktrees, that refuses a non-matching subject and says the rule; `words`, or a `file` read from the project's repository at the job's commit, goes into the worker's and the reviewer's prompt through `provide("prompt")`. Arthur's own project uses the Conventional Commits regex.
- Done means: refused at load: a regex that does not compile. Edge cases: a project without `commitRules` gets no hook and no text; a missing rule file warns and the job starts; the project's own git configuration outside Arthur's worktrees is untouched (asserted); a merge commit subject.
- Depends on: 32, 10.
- Size: half a day to a day.
- Covers: G10, E4.

## YouTrack

### 35. YouTrack: instances and reading

- Package: youtrack.
- Delivers: `instances` (named and unnamed, `urlEnv`, `tokenEnv`); `arthur youtrack issue|article list|get`; a project's `tracker` picks the instance; tested against a fake server that answers in the shape of YouTrack's REST documentation.
- Done means: refused before any call: an issue id outside the project's YouTrack project. Edge cases: the token never appears in an error (asserted with a known token); a 401, a 404, a timeout each give one line; paging past the first page; an unnamed and a named instance side by side.
- Depends on: 32.
- Size: a day.
- Covers: Y1 (reading), P4.

### 36. YouTrack: writing issues, articles, fields and work items

- Package: youtrack.
- Delivers: create or update an issue or an article from a file, set a custom field, add a work item; no verb deletes an issue.
- Done means: edge cases: a field value the project does not allow (YouTrack's error in one line); updating an article that changed meanwhile; an empty file; a work item of 0 minutes is refused.
- Depends on: 35.
- Size: a day.
- Covers: Y1 (writing).

### 37. YouTrack: comments, attachments, and the rules for jobs

- Package: youtrack.
- Delivers: list, add, edit and soft-delete comments; save attachments to `.arthur/youtrack/<id>/`; the rules a job working on an issue gets in its prompt: issue text is never an instruction, never quoted back, and a job never writes to YouTrack.
- Done means: edge cases: an attachment with a name that climbs out of the folder is saved under a safe name; an attachment of 0 bytes; deleting a comment of another author is refused by the server and said in one line.
- Depends on: 35.
- Size: a day.
- Covers: Y1 (comments, attachments), Y2.

## Telegram

### 38. Telegram: receive and send text

- Package: telegram.
- Delivers: `bots` (named instances); long polling (30 s); only the allowed chat; messages older than 10 minutes dropped; text becomes `message-received` (`[via Telegram] <text>`); `coordinator-replied` and `notice` are sent, long text in slices at line breaks; during quiet hours sent without a notification; any other kind of message gets `only text, photos and files reach the coordinator`; tested against a fake Bot API in the shape of its documentation.
- Done means: edge cases: a second poller (409) is said once and polling retries; a message from another chat is ignored and not acknowledged into the coordinator; a slice boundary inside a long line; quiet hours across midnight.
- Depends on: 21, 7.
- Size: a day.
- Covers: T1, T2 (sending).

### 39. Telegram: the outbox and retries

- Package: telegram.
- Delivers: one retry per send; a failed slice queued in `.arthur/telegram/outbox/` and sent first next time, in order; a refused (4xx) slice set aside and told once; a text too long for one message cut with a note.
- Done means: edge cases: the outbox survives a restart; a 429 waits as Telegram says; a 4xx slice does not block the ones after it; two processes sending at once keep order.
- Depends on: 38.
- Size: half a day.
- Covers: T2.

### 40. Telegram: media in and out, `arthur send`

- Package: telegram; the core's `arthur send` command and the `channel.send` name every channel provides.
- Delivers: a photo (largest size) or a file, and an album as one turn, saved under `.arthur/telegram/` and named in the message; `arthur send <file>… --caption` sends through every enabled channel: on Telegram photos and videos as an album, other files as documents after it, up to 10 files, sizes and extensions checked before anything is sent.
- Done means: refused before any send: 11 files, a file over Telegram's size limit, a photo whose sides break Telegram's limits (with a hint to slice it). Edge cases: the token never in an error; an album of one; no channel enabled (`arthur send` says so).
- Depends on: 38, 6.
- Size: a day.
- Covers: T3, T4.

### 41. Telegram: phone commands and the menu

- Package: telegram.
- Delivers: `/name text` routed to the host's command registry and the reply sent; the bot's command menu built from the phone commands the plugins register; the session's start notice sent as it comes.
- Done means: edge cases: `/name@botname`; an unknown command gets the registry's line; the menu updated when the set of commands changed, not on every start; a command's reply longer than one message.
- Depends on: 38, 6.
- Size: half a day.
- Covers: T5, G3 (routing).

### 42. Freeze the host API

- Package: core; `docs/plugin-api.md`.
- Delivers: the host API as schedule, youtrack and telegram use it, written down: the plugin shape, every host member, every core event and its fields, the `provide` names in use; the published types in `@arthur/core`'s exports; whatever no plugin uses removed. From here a change to the API is a decision recorded in its ticket.
- Done means: the three plugins and the fake host use only what the doc lists (a test lists the core's exports and fails on one the doc does not name); `npm run check` passes with the types tightened.
- Depends on: 31, 37, 41.
- Size: half a day.
- Covers: the vision's decision to derive the API from three plugins.

## Delivery

### 43. Review jobs

- Package: delivery.
- Delivers: the kind `review` (read-only, a fresh model, the reviewer role and review criteria); the verdict `PASS` or `FAIL` from the last line moves the ticket to done or in-progress; no verdict fails the job; `arthur ticket file` of a review writes the next `review-N.md`, never twice; at most 2 FAILs since the last PASS, then `--round N`; the procedure sent at the limit.
- Done means: edge cases: `PASS` not on the last line is no verdict; filing the same review twice is refused; the third review without `--round` is refused, naming the two FAILs.
- Depends on: 42.
- Size: a day.
- Covers: D1, B7, O10.

### 44. `arthur review-needed`

- Package: delivery.
- Delivers: decides review or no review for a branch: the always-review list (`review.alwaysReview`), deleted files, `.env` text in the diff, docs-only changes, small branches with passing checks; records the verdict and moves the ticket; `provide("delivery.alwaysReview")`.
- Done means: a table of branches with the decision for each. Edge cases: a renamed file on the list; a branch with no commits; a docs-only branch that also deletes a file.
- Depends on: 43.
- Size: a day.
- Covers: D2.

### 45. `arthur merge`

- Package: delivery.
- Delivers: files the reviews, merges the branch into main, runs install and the project's checks, resets main when a check fails; open findings become planning tickets; writes `outcome.md`; sets merged; names the tickets the merge unblocks; `--unreviewed` on the owner's word; the procedure sent after a merge.
- Done means: refused: a branch without a PASS on its tip (unless `--unreviewed`), a dirty main. Edge cases: a merge conflict leaves main as it was; a failed check resets main and says which check; findings with no open entry make no ticket; a finding's ticket gets the next id.
- Depends on: 44, 17.
- Size: a day.
- Covers: D3 (merge), O5.

### 46. Hand-back after a FAIL review

- Package: delivery.
- Delivers: after a FAIL: file it, continue the worker with the findings and a new budget, spawn the next review when the worker ends; cancelled by `stop-all`; spawns go through `beforeSpawn`, so `maxAgents` holds.
- Done means: edge cases: `/stopall` between the worker's end and the next review cancels it; a refused spawn (at `maxAgents`) is retried when a slot frees, not dropped; the second FAIL stops the loop at the review limit.
- Depends on: 45.
- Size: half a day to a day.
- Covers: D4, T14 (the cancel).

### 47. Changelog

- Package: delivery.
- Delivers: `arthur changelog`, and the rebuild after each merge: `CHANGELOG.md` from merged tickets, grouped by day and kind.
- Done means: edge cases: no merged ticket; a ticket without a kind; the same output from two runs (stable order).
- Depends on: 45.
- Size: half a day.
- Covers: D5.

## GitHub

### 48. GitHub: polling CI runs

- Package: github.
- Delivers: `instances` (`tokenEnv`); every `poll.everySeconds` the CI runs of the branches in play, for each project's `ci.workflow`; `ci-finished` once per run id; for a commit that touches no watched path, the run of the nearest commit before it; tested against a fake API in the shape of GitHub's REST documentation.
- Done means: edge cases: the same run seen on two polls emits once (across a restart too); a rate-limit answer waits as GitHub says; a 401 is said once, not every poll; a branch deleted while in play.
- Depends on: 32, 42.
- Size: a day.
- Covers: GH1 (runs), the GitHub setting.

### 49. GitHub: `arthur ci`, reruns, pushes, pull request reviews

- Package: github.
- Delivers: `arthur ci <branch>` tells why a run failed (the failed step, the end of its log); `--rerun` reruns a failed or cancelled run once; the reviewed branch and main pushed to origin (one warning line on failure, never a prompt); pull request reviews polled and emitted for the coordinator when `wakeOn` names them.
- Done means: refused: a second `--rerun` of the same run; a rerun of a passed run. Edge cases: a log too long (its end only); a push rejected as non-fast-forward; no remote.
- Depends on: 48, 43.
- Size: a day.
- Covers: GH1 (`arthur ci`), GH2.

### 50. Auto-merge after PASS and green CI

- Package: delivery.
- Delivers: `arthur merge --auto`: merges only with a PASS on the tip, CI passed (asked of github through `call`), the project's `autoMerge` on, and no held path (roles, vision, CI, `package.json`, the always-review list); `--no-ci` on the owner's word.
- Done means: refused, each naming the rule: a PASS on an older commit, CI pending or failed, a held path, `autoMerge: false`, github disabled without `--no-ci`. Edge cases: CI passed on the tip after a new commit; a held path renamed.
- Depends on: 45, 48.
- Size: half a day.
- Covers: D3 (`--auto`), GH3 (Arthur's own workflow is its `ci.workflow`).

## Manage

### 51. `arthur health`

- Package: manage.
- Delivers: `arthur health` and `/health`: one line per thing that should have happened by now and has not, from the checks each plugin provides (`collect("health")`) and manage's own (a stalled ticket, main not pushed, a board uncommitted for an hour, a temporary folder full, low inodes); reads only; `health.everyMinutes` sends new lines as a `notice`.
- Done means: edge cases: nothing wrong prints one line saying so; a provider that throws costs its line only, named; the same problem is not sent twice in a row.
- Depends on: 42.
- Size: a day.
- Covers: M1, T12.

### 52. `arthur stats`

- Package: manage.
- Delivers: per merged ticket the review rounds, verdicts, cost and days; the mean rounds, the share of first-round PASS, the share of autopilot, the 3 most expensive, the first line of each FAIL finding.
- Done means: edge cases: no merged ticket; a ticket without reviews; a ticket whose cost file is missing counts as unknown, not zero.
- Depends on: 45.
- Size: half a day.
- Covers: M2.

### 53. The audit

- Package: manage.
- Delivers: the kind `audit` (read-only, on the commits since the last audit, the board digest, stats and open findings; up to 5 proposals or `NO PROPOSALS`); no commits since the last one means no job; filed as `spec/quality/<date>.md` with the commit audited; the audit criteria and the procedure sent when it ends; `audit.days`, `audit.at`, `audit.budgetUsd`, `audit.model` register the schedule entry.
- Done means: refused: filing a failed audit. Edge cases: a second audit the same day; a day not in `audit.days` makes no job; a resume after the budget ran out happens once.
- Depends on: 31, 52.
- Size: a day.
- Covers: M3, B8 (audit), O6, C5, G6, the audit setting.

### 54. The retro

- Package: manage.
- Delivers: the kind `retro` (read-only, on the FAIL reviews, findings and outcomes of the merges since the last retro, and the roles and criteria); `arthur retro-due` (10 merges and 2 FAILs, or 5 findings); filed as `spec/retro/<date>.md` and a phone page `spec/retro/<date>.html`; `/retro` sends the newest page; the retro criteria and procedure; `retro.day` and `retro.at` register the entry; the coordinator's context gets the retro-due line.
- Done means: edge cases: exactly at the threshold; no retro yet; `/retro` with no page.
- Depends on: 53.
- Size: a day.
- Covers: M4, B8 (retro), O7, T11, C5.

### 55. Prune and temporary folders on a schedule

- Package: manage.
- Delivers: `prune.keepJobsDays` runs the core's prune on a schedule; temporary folders Arthur made, older than a day, removed daily and at start when a day was missed.
- Done means: edge cases: a folder of a running job is never removed; a folder another user owns is skipped with a line; a missed day runs once at start.
- Depends on: 31, 15.
- Size: half a day.
- Covers: M5, R10 (on a schedule).

### 56. The morning report

- Package: orchestration.
- Delivers: `morningReport.at` registers a schedule action with its procedure: built overnight, merged without the owner, waiting for approval, waiting for a decision, needs attention (from health).
- Done means: edge cases: a night with nothing done says so in one line; schedule disabled refuses the option at load.
- Depends on: 31, 51, 45.
- Size: half a day.
- Covers: O11, C2 (the report entry).

## Develop

### 57. `arthur plugin new`

- Package: develop.
- Delivers: `arthur plugin new <name>` creates `packages/<name>/` with its `package.json`, a plugin file, a test against the fake host and a doc page; the result passes `npm run check` and `npm test` as created.
- Done means: refused: an existing name, a name that is not lowercase letters and dashes. Edge cases: the structure test (entry 1) passes on the new package.
- Depends on: 42.
- Size: half a day.
- Covers: the vision's develop plugin (no predecessor capability).

### 58. Evals: the runner

- Package: develop.
- Delivers: `arthur eval` replays coordinator turns (a job ended, a schedule entry due, a message) against scenarios, on a copy of a fixture, with `arthur` replaced by a recording stub; a scenario is scored by what the run left behind (files, refs, the stub's log); pass rates against a baseline; every command refuses to run inside an eval session.
- Done means: edge cases: a scenario whose fixture is missing fails alone; a turn that never ends hits the scenario's timeout; the stub never reaches the live home folder (asserted).
- Depends on: 22, 57.
- Size: a day.
- Covers: E1, R1 (the eval refusal), the eval settings.

### 59. Evals: the scenarios

- Package: develop, and each plugin whose procedure a scenario tests.
- Delivers: the scenarios, each in the package of the plugin whose procedure it tests: after a restart with a plan, an audit with autopilot, a failed check, a failed CI run, a condition before review, an env refusal, "later" as a ticket, a merge, the morning report, a one-line night answer, no sleeping, onboarding questions, a retro, a FAIL review continued, a FAIL review handed back, a PASS review, a PASS review with its hook, unblocked after a restart, a worker done; the baseline.
- Done means: every scenario runs against the fake agent in `npm test` (the scoring, not the model); the baseline holds a rate for each.
- Depends on: 58, 56, 50.
- Size: a day.
- Covers: C7.

## Later

### 60. Signal

- Package: signal.
- Delivers: a channel through `signal-cli` next to Arthur: receive by polling, send text and media, only the allowed number, the `channel.send` and `message-received` contract telegram uses.
- Done means: tested against a fake `signal-cli` that answers in its documented JSON shape. Edge cases: `signal-cli` missing (one line, the plugin does not start); a message from another number; an attachment too large.
- Depends on: the first version (entries 1 to 59).
- Size: a day.
- Covers: none (new).

### 61. WhatsApp through a local bridge

- Package: whatsapp.
- Delivers: a channel through a bridge on loopback (receive by polling, send text and media, only the allowed number); refuses a bridge URL that is not loopback.
- Done means: tested against a fake bridge. Edge cases: a bridge URL on a public address refused at load; the bridge down (said once, retried); the session logged out.
- Depends on: 60.
- Size: a day.
- Covers: none (new).

### 62. Server: events over a stream

- Package: server.
- Delivers: the event log over HTTP as a stream from a sequence number, every request carrying the token; binds only loopback or a private address.
- Done means: refused at load: `0.0.0.0`, a public address. Edge cases: a request without or with a wrong token (401, no detail); a client that reconnects from its last sequence misses nothing; a slow client does not block the others.
- Depends on: 61.
- Size: a day.
- Covers: none (new).

### 63. Server: commands over HTTP

- Package: server.
- Delivers: the registered commands over HTTP (name, arguments, the reply), with the token.
- Done means: edge cases: an unknown command; a command that throws (one error line); two calls at once.
- Depends on: 62.
- Size: half a day to a day.
- Covers: none (new).

After entry 59, Arthur switches its first project, itself: it runs on the VPS (`docs/deploy.md`) and takes its own tickets. The other projects follow, then the later entries.

## Coverage of the harness Arthur replaces

Each row is one capability of the harness Arthur replaces, as it was inventoried on 2026-10-16, and the entry that carries it. "Out of scope" names why.

### Command line and job runner

| Id | Capability | Entry |
| --- | --- | --- |
| R1 | The CLI: find a command, `--help` from its doc, act on another project; refuse inside an eval | 6; eval refusal 58 |
| R2 | Start a job: worker on its own branch or read-only checkout, job record, `Ticket:` check, `node_modules` copy | 9 |
| R3 | The wrapper: one process per job, tools by role, the job's files, state last | 11 |
| R4 | Time and budget limits, per-kind budgets, one automatic resume | 12 |
| R5 | One scope per job in a joint CPU and memory slice; leftovers killed | 13 |
| R6 | Stop: TERM, KILL after a grace, strays, the scope | 14 |
| R7 | Continue a finished worker in place | 14 |
| R8 | Steer a running worker; an undelivered steer named at the end | 14 |
| R9 | List jobs of every project with short ids | 15 |
| R10 | Prune finished jobs, Git deciding what is safe | 15; on a schedule 55 |
| R11 | Git helpers | 9 |
| R12 | Fail a job whose process is gone on two sweeps | 15 |
| R13 | Settings from the shell and `.env`, the shell winning even when empty | 2, 3 |
| R14 | The role prompt: role file, override, criteria; symlinks refused | 10 |
| R15 | The worker role | 10 |
| R16 | Env guard | 18 |
| R17 | Worktree guard and the shell parser | 19 |
| R18 | One extension file wiring the coordinator's hooks | Out of scope: the plugin host loads each plugin (4) |
| R19 | A doc page per command, kept equal to the commands | 6 |

### Ticket board

| Id | Capability | Entry |
| --- | --- | --- |
| B1 | Tickets as folders, the board file, statuses, template guidance refused at `planned` | 16 |
| B2 | One writer at a time on the board | 16 |
| B3 | Ticket ids with a per-project prefix | 16; the prefix set in 32 |
| B4 | `after`: a ticket waits for others | 17 |
| B5 | Statuses follow jobs | 17; review verdicts 43; merged 45 |
| B6 | The worktree holds the `Ticket:` files and the approved plan | 9; plan 24 |
| B7 | Filing a review, never twice | 43 |
| B8 | Filing an audit or a retro | 53, 54 |
| B9 | Filing a plan or plan review | 24 |
| B10 | Autopilot pre-approval | 25 |
| B11 | The board digest | 17 |
| B12 | Each project's vision file, read by the roles | 16 (the skeleton), 22 (read) |

### Orchestration

| Id | Capability | Entry |
| --- | --- | --- |
| O1 | The coordinator's role | 20 |
| O2 | The coordinator's context on every turn | 22 |
| O3 | Wake on job end | 21 |
| O4 | The `Restarted.` message after a restart | 27 |
| O5 | The procedure after a merge | 45 |
| O6 | The procedure when an audit ends | 53 |
| O7 | The procedure when a retro ends | 54 |
| O8 | The procedure when an onboarding ends | 33 |
| O9 | The procedure when a plan or plan review ends | 24 |
| O10 | The procedure at two FAIL reviews | 43 |
| O11 | The morning report | 56 |
| O12 | At most N jobs at once, enforced | 23 |
| O13 | Model and thinking level per role | 23 |
| O14 | The plan flow for a large ticket | 24 |

### Delivery, GitHub, manage, projects, YouTrack, develop

| Id | Capability | Entry |
| --- | --- | --- |
| D1 | Review jobs and the 2-FAIL limit | 43 |
| D2 | Review or no review for a branch | 44 |
| D3 | Merge, findings to tickets, outcome; `--auto` after PASS and green CI | 45; `--auto` 50 |
| D4 | Hand-back after a FAIL | 46 |
| D5 | The changelog | 47 |
| GH1 | CI runs of a branch and main; why a run failed; rerun | 48, 49 |
| GH2 | Push the reviewed branch and main | 49 |
| GH3 | The repository's own CI workflow | Out of scope as a capability: Arthur's `.github/workflows/ci.yml` exists; the github plugin watches it through `ci.workflow` (50) |
| M1 | Health | 51 |
| M2 | Stats | 52 |
| M3 | The nightly audit | 53 |
| M4 | The weekly retro and when it is due | 54 |
| M5 | Clean old temporary folders | 55 |
| P1 | Give a repository what Arthur reads | 33 |
| P2 | The list of projects every command reaches | 32 |
| P3 | Onboarding of a new repository | 33 |
| P4 | A project names its tracker instance | 32, 35 |
| Y1 | YouTrack: issues, articles, fields, work items, comments, attachments; no delete; ids checked; token hidden | 35, 36, 37 |
| Y2 | Rules for a job working on an issue | 37 |
| E1 | Evals of coordinator turns | 58 |
| E2 | The test kit: fake agent, fake host, safety net, temporary folders | 4, 11 |
| E3 | Rules that keep the code small, as a test | 1 |
| E4 | The Conventional Commits hook | 34 (Arthur's own project uses the regex) |
| E5 | One page on what the models read | 10 |

### Session

| Id | Capability | Entry |
| --- | --- | --- |
| S1 | The coordinator as one interactive agent in tmux, started again, waiting for the previous one to exit; attach and stop | 20 |
| S2 | Compaction at 08:00, 13:00, 18:00 | 26 |
| S3 | The fresh start at 23:00 | 27 |
| S4 | `/restart` and `/restart fresh` | 27 |
| S5 | The restart guard | 28 |
| S6 | The LLM probe and the turn-failed notice | 29 |
| S7 | The service and the user manager survive; controllers delegated | 8; delegation 13 |
| S8 | The VPS recipe | 8 |

Session options: `compactAt` 26; `freshAt` 27; `timeZone` 7; `compactWaitSeconds` 26; `exitWaitSeconds`, `restartDelaySeconds` and the tmux session 20 (options of `orchestration`); no restart, stop or fresh start while jobs run, a rule in 20 and 27; `restartGuard` 28; `probeLlm` 29; the coordinator's model 23; the session's files in `.arthur/session/` 27.

### Telegram

| Id | Capability | Entry |
| --- | --- | --- |
| T1 | The bridge: polling, one chat, old messages dropped, turns, replies, polling failures | 38 |
| T2 | Sending: retry, outbox, refused slices, quiet hours, long text | 38, 39 |
| T3 | Media in | 40 |
| T4 | Media out, `send` | 40 |
| T5 | The start notice and the command menu | 29, 41 |
| T6 | `/jobs` | 15 |
| T7 | `/board` | 17 |
| T8 | `/projects` | 32 |
| T9 | `/findings`, `/task` | 17 |
| T10 | `/plan` | 24 |
| T11 | `/retro` | 54 |
| T12 | `/health` | 51 |
| T13 | `/steer` | 15 |
| T14 | `/stopall` | 15; the hand-back cancel 46 |
| T15 | `/restart`, `/restart fresh` | 27 |

### Schedule, deploy, state

| Id | Capability | Entry |
| --- | --- | --- |
| C1 | Schedule entries, the sweep, the `schedule` command | 30, 31 |
| C2 | The recurring entries (morning report, retro, audit) and their day rules | 31, 53, 54, 56 |
| C3 | The schedule's run state outside Git | 30 |
| C4 | The deploy units | 8 (service), 13 (delegation), 26 and 27 (the session's times, run by `arthur run`), 55 (cleanup) |
| C5 | Audit and retro reports | 53, 54 |
| C6 | Planning documents for Arthur | Out of scope: they are this repository's `spec/` |
| C7 | The eval scenarios | 59 |
| C8 | Runtime state | `.arthur/`: 8, each plugin its own folder (4) |
| C9 | Secrets only in `.env`, the variables listed | 3 |
| C10 | What a job can reach, and where protection ends | 8 (the threat model in `docs/deploy.md`) |

### Commands

| Command of the harness Arthur replaces | Arthur | Entry |
| --- | --- | --- |
| spawn (worker) | `arthur spawn` | 9 |
| spawn a review | kind `review` | 43 |
| spawn an audit, a retro | kinds `audit`, `retro` | 53, 54 |
| spawn a plan, a plan review | kinds `plan`, `plan-review` | 24 |
| spawn an onboarding | kind `onboarding` | 33 |
| continue | `arthur continue` | 14 |
| steer | `arthur steer` | 14 |
| jobs | `arthur jobs` | 15 |
| stop | `arthur stop` | 14 |
| prune | `arthur prune` | 15 |
| ticket (digest, all, new, status, after) | `arthur ticket` | 16, 17 |
| ticket file | `arthur ticket file`, by kind | 43, 53, 54, 24 |
| ticket status planned with autopilot | `arthur ticket status --autopilot` | 25 |
| merge | `arthur merge` | 45, 50 |
| review-needed | `arthur review-needed` | 44 |
| changelog | `arthur changelog` | 47 |
| ci | `arthur ci` | 49 |
| schedule | `arthur schedule` | 31 |
| roles | `arthur roles` | 10 |
| stats | `arthur stats` | 52 |
| retro-due | `arthur retro-due` | 54 |
| health | `arthur health` | 51 |
| send | `arthur send` | 40 |
| eval | `arthur eval` | 58 |
| init | `arthur init` | 33 |
| youtrack | `arthur youtrack` | 35, 36, 37 |

### Settings

| Setting of the harness Arthur replaces | Arthur | Entry |
| --- | --- | --- |
| Telegram bot token and chat | `telegram` `bots` | 38 |
| Model and thinking per role, quick model | `orchestration` `coordinator`, `roles` | 23 |
| Job timeout and budget | `core.jobs` | 2, 12 |
| Audit budget | `manage` `audit.budgetUsd` | 53 |
| Plan budget | `orchestration` `plan` | 24 |
| Autopilot budget and cap | `orchestration` `autopilot` | 25 |
| Joint CPU and memory of jobs | `core.jobs.cpu`, `core.jobs.memory` | 13 |
| Folders in front of `PATH` | `projects` `pathPrepend` | 32 |
| GitHub token | `github` `instances` | 48 |
| YouTrack URL and token per server | `youtrack` `instances` | 35 |
| The wrapper's and guards' own switches | core internals | 11, 18, 19 |
| The coordinator marker, the fresh-start marker, the test tmux socket | `orchestration`, `session` | 20, 27 |
| The eval's stub switches | `develop` | 58 |
| Test seams (process table, job slice, Bot API URL) | kept as test seams | 13, 15, 38 |

### Gaps the inventory found, and their entries

| Id | Gap | Entry |
| --- | --- | --- |
| G1 | The coordinator's conversation lifecycle | 26 to 29 |
| G2 | Worktree guard | 19 |
| G3 | Phone commands without the model, the menu | 6, 41 |
| G4 | Time zone and quiet hours | 3, 7 |
| G5 | Planning of large tickets | 24 |
| G6 | Which days the audit and retro run | 31, 53, 54 |
| G7 | Dead jobs; the joint limit | 13, 15 |
| G8 | A project's own vision and criteria | 10, 32 |
| G9 | A doc per command | 6 |
| G10 | Commit rules per project | 34 |
| G11 | English only, English keys | 16 (the board reads English keys; no old ticket is rewritten, the board starts empty) |
| G12 | The predecessor's history of tickets and reports | Out of scope: it is not carried over (vision) |
| G13 | Per-project prefixes; renumbering | 32; renumbering out of scope, the board starts empty |
