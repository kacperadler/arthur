# Roadmap

The ordered list of feature tickets that builds Arthur from the core to the plugins (`spec/vision.md`). The coordinator creates one ticket per entry, in this order, and starts an entry once everything in its "Depends on" is merged. Each entry is half a day to a day of agent work.

How to read an entry:

- Package: where the code lives. `packages/core/` is `@arthur/core`; a plugin is `packages/<plugin>/`, `@arthur/<plugin>`.
- Delivers: what it adds, and through which interface (a command, an event, the host API, an option).
- Done means: what a reviewer checks, edge cases included. Every entry also means: its tests run under `npm test` against fakes (the core against a fake plugin and a fake agent, a plugin against the fake host of `@arthur/core/testing`), `npm run check` and `npm test` pass, each command it adds has its doc page, each option it adds is in `arthur.config.example.ts`, and, once entry 80 is merged, each thing its plugin needs to work (a binary, a token, a reachable service) is a requirement it provides to `collect("doctor")`.
- Covers: the capabilities of the harness Arthur replaces that it carries over, by their id in the table at the end.

Order: the core first, piece by piece, then the first-version plugins in the vision's order, then the later plugins. Within the core the event stream comes right after the plugin host, because the job runner and the board emit into it from their first line. Job state (16) comes right after the job runner it describes, and jobs on another machine (21, 22) after the guards they carry there. Machines and resources (30 to 34) come right after orchestration, whose `maxAgents` and context they build on; placement reads the project list and the per-feature caps read the board through the host, so neither waits for the `projects` plugin. The plugin API is frozen (entry 51) only after schedule, youtrack and telegram use it. An entry that needs a plugin built later sits after that plugin (the morning report, the auto-merge). Disk and Docker (69 to 72) close the first version, before the switch: the disk floor extends the free resources of 34, the labels read the project list (41), the cleanup runs in the one worktree removal that prune (15) and the merge (54) share, and the sweep registers its entry with schedule (40). `arthur doctor` (80) sits right after the start notice (38), which it runs before, and took the next free number so that 1 to 79 keep theirs; a plugin built after it brings its own requirements. Voice (81) sits right after telegram's media (49), whose `parts` and `message.part` it plugs into, and before the freeze (51), so `message.part` is frozen as a plugin uses it; it took the next free number too. Models (82) sit right after `arthur doctor` (80), whose requirements they add, and after the roles' models (26) and the job limits (12) they extend; they took the next free number too. The later channels (73, 74) use the same `parts`, so every media plugin works with them unchanged.

The host API, as these entries build it (names are proposals; entry 51 fixes them): a plugin is a function from its options to `{ name, requires, setup(host), start?(), stop?() }`. `setup` registers; `start` runs long-lived work and is called only by `arthur run`. A `jobs.spawn` before every plugin's `setup` has run throws `<plugin>: spawn during setup; start jobs from start() or later`, so no job starts before the core follows the jobs. The host gives a plugin its options with every `...Env` name resolved, its own folder `.arthur/<plugin>/`, `events` (`on`, `emit`), `commands` (`register`), `jobs` (`registerKind`, `spawn`, `beforeSpawn`, `prepare`, `registerExtension`, `cleanup`, `block`, `unblock`, `registerMachine`, `run`), `board`, `clock`, `projects()`, and `provide(name, fn)` / `call(name, ...)` / `collect(name)`, through which plugins reach each other without importing each other.

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
- Delivers: `arthur run` loads the config, sets up every plugin, calls `start` in dependency order, and on SIGTERM calls `stop` in reverse; one process per home folder (a pid lock taken over from a dead pid). From the lock until the stops, it follows `.arthur/events.jsonl` from the last number it delivered, every 500 ms, and delivers to its subscribers the events another process (a command such as `arthur ticket` or `arthur spawn`) appended; a process that emits still delivers its own at once, and the daemon never delivers its own twice. No socket or port carries events. `docs/deploy.md`: install Node, git, tmux and OMP on a VPS, the systemd user service that keeps `arthur run` alive (started again after it dies, the user manager too), `.env`, the threat model, daily use, updating.
- Done means: a second `arthur run` on the same home refuses, naming the pid; a stale lock of a dead pid is taken over; a plugin whose `start` throws stops the others already started, in reverse, and the process exits non-zero naming the plugin; SIGTERM during `start` still stops what started; an event a command emits reaches the daemon's subscribers once. Edge cases: a first start begins at the log's end; a later start delivers every event after the kept number (AR0044); a line still being written waits for its line break; a log cut or deleted by hand is followed from its new end; a plugin that emits during its stop gets the events appended before its own first, so the log's order and the kept number hold.
- Depends on: 4, 5.
- Size: half a day to a day.
- Covers: S7 (the restart of the service and of the user manager), S8, C4 (the core's units), C8 (the home folder).

### 9. Job runner: spawn and the job record

- Package: core.
- Delivers: `arthur spawn <task>` and `host.jobs.spawn`: a worker job on its own branch and worktree from HEAD, or a read-only kind in a detached checkout; `host.jobs.registerKind({ name, readOnly, role, budgetUsd?, timeoutMinutes? })` so a plugin owns its kinds; `host.jobs.beforeSpawn(check)` so a plugin can refuse a spawn with a reason; `host.jobs.prepare(fn)`, run after the worktree exists and before the agent starts (a hook to install, a file to place); the job record `.arthur/jobs/<id>/` (task, kind, model, thinking, timeout, budget, branch, root, worktree, project); every `Ticket:` file the task names must exist in the worktree; the id returned in about a second; `job-started` emitted.
- Done means: tested with real Git in a temporary repository. Refused before any record or worktree exists: an unknown kind, a missing `Ticket:` file (named), a `beforeSpawn` refusal (its reason printed). A `prepare` that throws removes the worktree and the record and names the plugin. Edge cases: a repository with uncommitted changes (the job starts from HEAD, the changes stay); two spawns at once get distinct ids and branches; a branch name that exists already.
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
- Delivers: one background process per job that starts `omp` with the role's tools (a worker gets edit and write; every other kind is read-only), model, thinking level and prompt; writes `state`, `pid`, `log`, `result`, `cost`, `tool-calls`, `activity`, `commits`, with `state` last; emits `job-ended` with the state. The fake agent is a script on `PATH` that plays a scripted run (tool calls, cost, final message, exit code).
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

### 16. Job state: working, idle, blocked, ended

- Package: core; the worker role (10) gains the `Blocked:` line.
- Delivers: every job is in one of four states, kept in its record (`state`, with `reason` and `since`) and emitted as `job-state` (`id`, `project`, `ticket`, `machine`, `from`, `to`, `reason`) on each change. `working`: the agent is in a turn, with output or a tool call within the last `jobs.idleMinutes`. `idle`: its process is alive and not blocked, but has done nothing for `jobs.idleMinutes`. `blocked`: it cannot go on until something outside it happens, and the reason says what: `user: <question>` or `dependency: <what>`. `ended`: nothing more will happen, with the outcome (finished, failed, stopped, the limit hit, process gone). A run ends `blocked` instead of `ended` when the first line of its final message is `Blocked: user <question>` or `Blocked: on <ticket or job id>`, which the worker role tells a worker to write when it stops for one of them; the state a run ends in is written after every other file of the record, as entry 11 writes it. `host.jobs.block(id, reason)` and `unblock(id)` let a plugin hold a job (a machine offline, a cap reached); `arthur continue` moves a blocked or ended job back to `working`. `arthur jobs` and `/jobs` show each job's state, reason and for how long; `arthur jobs --state <state>` filters.
- Done means: a table of fake-agent runs and the states each passes through. Edge cases: a `Blocked:` line that is not the first line ends the run `ended`; no activity for exactly `jobs.idleMinutes` turns a job idle, one minute less does not; the next tool call turns it back to working with one event; a state that does not change emits nothing; a plugin's block wins over idle, and `unblock` returns the job to working or idle by its activity; a job blocked after its run ended is not failed as `process gone` by the sweep (15); `jobs.idleMinutes: 0` turns idle off; `continue` of a blocked job clears its reason.
- Fixed by design (the owner, 2026-10-16): the four states are facts about the process and stay in code, never configured; what happens on a change (a message, a ping, a move on the board) is a plugin's handler of `job-state`, its rules described in that plugin's Markdown.
- Depends on: 14, 15.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

### 17. Ticket board: tickets and the board file

- Package: core; the ticket templates ship with the core.
- Delivers: tickets as folders `spec/features/<id>-<slug>/` (`ticket.md`, `findings.md`, `review-N.md`, `outcome.md` from templates); the board `spec/build.json` of each project, changed only through `arthur ticket`; ids are the project's prefix and a number, from 1; statuses planning, planned, in-progress, review, done, merged, dropped; one writer at a time (a lock taken over from a dead pid); `ticket-created` and `ticket-moved` events; `host.board` for plugins.
- Done means: `planned` is refused while template guidance is left in the ticket. Edge cases: two writers at once never lose a change; a lock of a dead pid is taken over; a hand-broken board file is refused, naming the file, never overwritten; ids continue after a dropped ticket; an empty board.
- Depends on: 5, 6.
- Size: a day.
- Covers: B1, B2, B3 (the prefix), B12, G11, G13 (the prefix's use).

### 18. Ticket board: transitions, `after`, the digest, and the board's phone commands

- Package: core.
- Delivers: the allowed status transitions, statuses that follow jobs (`job-started` of a worker sets in-progress), merged and dropped final; `arthur ticket after <id> <ids>` (a ticket waits for others); the board digest (every open ticket, the 10 newest merged, one line for the rest); phone commands `/board [PREFIX] [all]`, `/task <id>`, `/findings <id>`, the id given as `14`, `AR14` or the full id.
- Done means: refused: a transition the table does not allow, an `after` that makes a cycle, names an unknown or a dropped id. Edge cases: a merged ticket never moves back; the full board when it fits one message, else the digest; `/findings` of a ticket without the file; an id with another project's prefix.
- Configurable (the owner, 2026-10-16): `board.statuses` (names, which are final) and `board.transitions` in the config, checked at load (an unknown name in a transition, no final status, a status the job events need missing: refused); the code enforces them; what each status means and what the coordinator does in it is the project's Markdown beside the roles. Without them, today's set and table hold.
- Depends on: 17, 9.
- Size: a day.
- Covers: B4, B5, B11, T7, T9.

### 19. Env guard

- Package: core; an OMP extension loaded in every job and in the coordinator.
- Delivers: a tool call that names a secrets file (`.env`, not `.env.example`) is refused, down to quoting, expansion and options that carry the name; one `sed -i` that sets a key without printing is allowed.
- Done means: a table of calls, each refused or allowed, and each refusal names the file. Edge cases: `cat .e''nv`, `cat "$HOME/x/.env"`, `--env-file=.env`, a glob that matches `.env`, `.env.example`, `.envrc`, a path `.env/` that is a folder.
- Depends on: 11.
- Size: half a day to a day.
- Covers: R16.

### 20. Worktree guard and its shell parser

- Package: core; an OMP extension loaded in every job.
- Delivers: in every job, a file tool or bash command that writes into the main checkout, the home folder `.arthur/`, or another job's worktree is refused: redirects, writing commands, `git` writes, `cd` there, symlinks, `git stash`. Reading passes. The shell parser is its own file, shared with the env guard.
- Done means: a table of commands, each refused or allowed. Edge cases: a relative path that climbs out of the worktree; a symlink inside the worktree that points out of it; `cd` into the main checkout followed by a write; a heredoc; a write into the job's own worktree passes.
- Depends on: 19.
- Size: a day.
- Covers: R17, G2.

### 21. Jobs on another machine: spawn, run, and the branch back

- Package: core; the machine's prerequisites in `docs/deploy.md`.
- Delivers: `host.jobs.registerMachine({ name, ssh, home, labels })`, with `local` always registered; `arthur spawn --machine <name>` and `host.jobs.spawn({ machine })`; when a spawn names no machine, the runner asks `call("jobs.place", job)` if a plugin provides it, else runs the job on `local`. For a job on another machine, every step runs over `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 <ssh>`, so ssh never asks for a password or accepts a host key on its own: the project's repository there (created empty on first use) gets the base commit by `git push` over SSH; the worktree and the wrapper with the env and worktree guards run there through that machine's own `arthur`; `prepare` runs here, in the main process, and acts on the machine through `host.jobs.run(machine, argv)` (one command over the same SSH, its exit code and output returned), so the install of 41 runs there without plugins or secrets on the machine; each sweep copies the record's changed files back with one SSH call per machine; when the job ends, its branch is fetched into the main checkout. The record names its machine. The machine's prerequisites: Node, git, OMP logged in with its own credential, and the same version of Arthur's core; Arthur sends it no secret.
- Done means: tested with real Git and a fake `ssh` on `PATH` that runs the command in a second temporary folder, the "machine", and can fail as ssh does (exit 255 and its line). Refused before any record exists, naming the machine: an unknown machine; the SSH key refused (`Permission denied (publickey)`, ssh's line quoted); `arthur` missing there or of another version (both versions named). Edge cases: the project's repository missing there (created); a base commit already there (no second push); the fetched branch already in the main checkout from an earlier run (updated, not duplicated); a job on `local` takes no SSH step at all.
- Depends on: 16, 20.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

### 22. Jobs on another machine: stop, steer, continue, and the machine going offline

- Package: core.
- Delivers: `arthur stop`, `steer`, `continue` and `prune` of a job on another machine run there over SSH; a machine that does not answer (ssh exit 255) puts its running jobs in `blocked` with `dependency: machine <name> unreachable since <time>` instead of failing them as `process gone`; back within `jobs.offlineGraceMinutes`, each job takes the state its record there says (it kept running there); past the grace they end `failed: machine offline`, and their worktree there is kept for the human.
- Done means: refused, naming the machine: `stop`, `steer` or `continue` of a job whose machine is offline. Edge cases: the machine offline mid-job and back before the grace (the job's commits all arrive, nothing ran twice); offline past the grace (failed once, one line, the worktree there untouched); a job that ended while its machine was offline (its end and branch arrive when the machine is back, even past the grace); `prune` never deletes a worktree on a machine it cannot reach.
- Depends on: 21.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

## Orchestration (required)

### 23. The coordinator's process and `arthur attach`

- Package: orchestration.
- Delivers: the plugin, required; its options (`maxAgents`, `coordinator`, `roles`, `plan`, `autopilot`, `morningReport`) checked; one interactive `omp` in its own tmux session (`coordinator.tmux`), with `--continue` and the coordinator's model and thinking, started with `-e` on `@arthur/core/env-guard` like every job; started again `restartDelaySeconds` after it ends for any reason; a start waits up to `exitWaitSeconds` for the previous `omp` to exit, so two never refresh the agent's credential at once; `arthur attach`; `arthur coordinator stop`, refused while any job runs; the coordinator's role file, in English.
- Done means: tested with the fake agent and a tmux socket in the test's folder. Edge cases: the previous `omp` still alive after the wait (the start is refused and logged, then retried); the coordinator crashing in a loop does not spin faster than the delay; `attach` with no session says so; a coordinator tool call naming a secrets file (`.env`) is refused with the env guard's line. The coordinator's role file carries the rule (AR0090, the harness's K0264) that a reply is written for an owner who remembers nothing of earlier turns, tickets, or files: every ticket, finding, job, or project a reply names gets at least one plain sentence on what it is and what the owner will see change (never file names); an id never stands alone. Every question to the owner says what is being decided, why it came up, the options with what each means in practice, and the coordinator's recommendation, so the message alone answers it. This outranks any limit on a reply's length: a reply that needs it runs longer, short per item.
- Depends on: 8, 10, 15.
- Size: a day.
- Covers: S1, O1, the coordinator's settings and the session options it owns.

### 24. The coordinator's inbox and the wake on job end

- Package: orchestration; an OMP extension in the coordinator's session.
- Delivers: messages for the coordinator (`message-received` from a channel, a schedule action, a job's end) are queued and delivered as turns, in order, once the session is idle, except a human's message from a channel that arrives mid-turn: it joins the running turn after the next tool call (marked as sent during the turn), so the one reply that ends the turn answers it together with what the turn was already answering; a job's end or a schedule action never joins a turn; each finished turn is emitted as `coordinator-replied`; one wake message per sweep for the jobs that ended (state, the first 15 lines of the result, the procedure the kind's plugin names, the project when it is not the main one), claimed only after it was delivered; a footer while jobs run.
- Done means: edge cases: two jobs ending in one sweep make one message; a failed delivery is retried and the third failure is told; a human's message arriving mid-turn reaches that turn and is answered in its reply, and two arriving in one tool call reach it in order; a wake arriving mid-turn waits; a turn ending as the message arrives gets it as the next turn, never lost; the coordinator role carries the rule that a reply answers every human message since the last reply and names a question it still leaves open; nothing is lost or delivered twice across a coordinator restart.
- Depends on: 23.
- Size: a day.
- Covers: O3.

### 25. The coordinator's context on every turn

- Package: orchestration.
- Delivers: on every turn the coordinator reads its role, each project's vision, the styleguide, a warning per missing criteria file, the board digest, the local time and whether it is night (from `host.clock`), and the lines other plugins add through `collect("coordinator.context")` (session: restart due; manage: retro due).
- Done means: edge cases: a project without a vision file gets a warning line, not a failure; a contributing plugin that throws costs its line only, named; quiet hours across midnight.
- Depends on: 24, 18, 7.
- Size: half a day.
- Covers: O2.

### 26. `maxAgents` and the models of each role

- Package: orchestration.
- Delivers: `maxAgents` enforced through `beforeSpawn` across all projects, for every spawn, the human's included; the model and thinking level of each role and the quick model from `roles`; `--model` on a spawn wins.
- Done means: refused: a spawn when `maxAgents` jobs run (the message names them); an invalid thinking level, before any job record exists. Edge cases: `maxAgents` of 1; a job ending frees its slot at once; a role without a model uses the agent's default.
- Depends on: 23.
- Size: half a day.
- Covers: O12, O13, the model settings.

### 27. Job state in the coordinator and the channels

- Package: orchestration.
- Delivers: the coordinator's context lists every job that has not ended, grouped by state (`blocked` first), each with its reason and for how long; the wake message (24) says the state a run ended in and, for `blocked: user`, the question; a job that turns blocked on the user emits one `notice` (`<id> asks: <question>`), which every channel sends; the footer counts running jobs by state. On the channels `/jobs` shows the same states (16).
- Done means: edge cases: a job blocked and continued before the next turn shows as working; one notice per block, not one per turn; a question longer than a message is cut, with the job id to read it whole; quiet hours send the notice without a notification (the channel's rule); no unended job means no section.
- Depends on: 26, 16.
- Size: half a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

### 28. Planning of large tickets

- Package: orchestration.
- Delivers: `- Plan: yes` under a ticket's Goal; the kinds `plan` (read-only planner) and `plan-review`; `arthur ticket file` of a plan (replaces `plan.md`, history in Git) and of a plan review (`plan-review-N.md`); a worker on such a ticket needs its approved `plan.md`; the plan budget option; the procedure sent when a plan or plan review ends; the phone command `/plan <id>`.
- Done means: refused: a worker spawn on a plan ticket without an approved plan; filing a failed plan job. Edge cases: re-planning keeps one `plan.md`; plan review numbers continue; `/plan` of a ticket without a plan.
- Depends on: 25, 18.
- Size: a day.
- Covers: O9, O14, B6 (the plan part), B9, T10, G5.

### 29. Autopilot

- Package: orchestration.
- Delivers: `arthur ticket status <id> planned --autopilot`: pre-approval of a ticket from an audit or a finding, kind bug or cleanup, at most 3 Scope files, none on delivery's always-review list (asked through `call`), a budget above 0 and at most the cap; records `Pre-approved by policy`; the autopilot criteria file.
- Done means: refused, each naming the rule broken: a feature ticket, 4 Scope files, a file on the always-review list, budget 0, a budget over the cap. Edge cases: exactly 3 files; the always-review list not provided (delivery off) refuses rather than passes.
- Depends on: 28.
- Size: half a day.
- Covers: B10, the autopilot settings.

## Machines and resources

### 30. Machines: the list, labels, and SSH checks

- Package: machines.
- Delivers: the `list` option: each machine's `name`, `ssh` (a `Host` of `~/.ssh/config` or a Tailscale name), `home`, `labels` (`os`, `arch`, `tools`) and `maxJobs`; `local` (os and arch detected, `tools` and `maxJobs` from the option); each registered with the core's job runner (21). At start and every `check.everySeconds`, `ssh <host> arthur version` and the machine's os and arch, compared with its labels; `machine-online` and `machine-offline` (with the reason) emitted once per change. The address `ssh -G <host>` resolves to must be private (loopback, RFC 1918, Tailscale's `100.64.0.0/10` and `fd7a:115c:a1e0::/48`): Arthur reaches its machines only over the private network. `arthur machines` and `/machines`: each machine, its labels, online or why not, its jobs.
- Done means: tested against the fake host and a fake `ssh` on `PATH`. Refused at load, naming the machine: two machines with one name, a machine named `local`, an `os` label other than `linux` or `macos`, a host that resolves to a public address. Edge cases: the SSH key refused (the machine offline with ssh's line, said once, never retried with a password); an unknown or changed host key (offline, never accepted on its own); labels that disagree with what the machine reports (`os: macos` on a Linux box: offline, both named); a machine that goes offline and back emits each change once; `arthur` missing there.
- Also delivers (the owner, 2026-10-16: test the connections at start, the way the tools are checked): one `arthur doctor` (80) line per machine, `machines <name>: ok (linux x64, arthur <version>)` or `missing: <reason>` with the fix (`ssh-copy-id`, `ssh-keyscan` checked by the owner, `npm i -g arthur`), each check cut after 10 s; a machine is never critical, so `arthur run` starts with one offline and says which in the start notice; machines are checked in parallel, so ten offline machines cost 10 s, not 100.
- Depends on: 22, 6.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

### 31. Machines: placing a job by labels

- Package: machines; the `requires` option of `projects` and the `requires` key of a ticket's JSON block.
- Delivers: a job's required labels: `arthur spawn --requires os=macos,tools=xcode`, else its ticket's `requires`, else its project's, else none; `provide("jobs.place")`: among the online machines that have every required label (`tools` needs each tool listed) and are under their `maxJobs`, the one with the most room (from `call("resources.free")` when the resources plugin provides it, else the fewest jobs), `local` on a tie; `--machine` is checked against the labels too. Every job of a ticket (worker, review, plan) is placed by the same labels, so its checks run where it was built.
- Done means: refused before any record exists, naming the labels and each machine with its labels and state: a label no machine has; machines that have it but are all offline or full; `--machine` on a machine without a required label. Edge cases: a ticket's `requires` replaces the project's as a whole; an empty `requires` on a ticket clears the project's; a job without ticket or project requirement may go anywhere; the project list not provided (projects off) means no project requirement.
- Depends on: 30, 18.
- Size: half a day to a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

### 32. Resources: caps per job

- Package: resources; the core's job scope (13) reads the caps through `call("jobs.limits", job)`.
- Delivers: `perJob.cpu` and `perJob.memory`, set on each job's own scope (`CPUQuota`, `MemoryMax`) inside the joint slice of entry 13, on every machine; where there is no user manager (macOS), memory is held by sampling the job's processes every 10 seconds and stopping it, and CPU is not capped, said once per machine. A job over its memory cap ends `limit: memory`; CPU over its cap is slowed, not stopped. Time and money of one job stay the core's (`jobs.timeoutMinutes`, `jobs.budgetUsd`, entry 12).
- Done means: tested with a test slice name, never the production one, removed after the run. Refused at load: a per-job cap above the joint `jobs.cpu` or `jobs.memory`. Edge cases: a job that exceeds its memory cap ends with `limit: memory` and the other jobs keep running; on a machine without a user manager the same job is stopped within one sample; a `cpu` larger than a machine's cores is capped at its cores; the plugin off leaves the joint slice as the only limit.
- Depends on: 13, 16.
- Size: half a day to a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

### 33. Resources: caps per feature

- Package: resources.
- Delivers: `perFeature` caps over all jobs of one ticket together (worker, reviews, plans): `budgetUsd` (the sum of their costs), `hours` (the sum of their run time), `cpu` and `memory` (a slice per ticket inside the jobs' slice, on each machine); a ticket's JSON block may set its own `caps`, each replacing the option's, `0` meaning no cap. A spawn for a ticket at its money or time cap is refused through `beforeSpawn`, naming the spend and the cap; a running job that takes its ticket past the cap is stopped and held `blocked` (`user: feature cap <what> reached: <spent> of <cap>`) through `host.jobs.block`, so `arthur continue` resumes it once the human raises the cap; `cap-reached` emitted; `arthur resources <ticket>` shows the spend against each cap.
- Done means: edge cases: a job that exceeds its feature's cap (a cost exactly at the cap stops, one cent below does not); two jobs of one ticket crossing the cap together are both stopped and `cap-reached` is emitted once; a ticket's `caps` below what it has spent refuses the next spawn; a job whose cost file is missing counts as its whole budget, never as zero; a job without a ticket is held by the per-job caps only.
- Depends on: 32, 18.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

### 34. Resources: how many jobs run, from each machine's free resources

- Package: resources; `maxAgents` of `orchestration` stays the upper bound.
- Delivers: each machine's free CPU and memory at every machine check (Node's `os` on `local`, the same over SSH elsewhere); `provide("resources.free")`, which placement (31) reads; through `beforeSpawn`, a job starts only when its machine keeps `keepFree` after the job's `perJob` reservation, and the refusal names each candidate machine and what is short; `maxAgents` still refuses above that. The coordinator's context gets one line per machine (`local: room for 2 more jobs (5.1 GB, 3.4 cores free)`) through `collect("coordinator.context")`, so it decides how many jobs to start; `arthur resources` and `/resources` show the same.
- Done means: refused: every spawn when free resources are too low to start anything, naming each machine and its shortfall (a normal `beforeSpawn` refusal, retried when a job ends as at `maxAgents`). Edge cases: room for more jobs than `maxAgents` (`maxAgents` refuses); a reservation exactly equal to what is free above `keepFree` starts; two spawns at once never both take the last room (jobs started since the last check count with their reservation); a machine whose check fails counts as no room, said once.
- Depends on: 33, 31, 26, 25.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

## Session

### 35. Compaction during the day

- Package: session.
- Delivers: at each `compactAt` time in `timeZone`, once the session is idle with nothing queued, the coordinator first writes a handoff, `.arthur/session/handoff.md`: the work in progress, the next steps, and every question to the human still unanswered, with when it was asked; then the conversation is compacted with the agent's own compaction, and the compacted conversation starts by reading the handoff. After `compactWaitSeconds` the request is withdrawn with one line (`compact: skipped, session busy for N s`); a handoff write that fails (no new handoff when the coordinator's turn ends) withdraws the compaction with one line (`compact: skipped, handoff not written: <reason>`); nothing happens when no session runs; running jobs do not block compaction.
- Done means: edge cases: a slot missed while Arthur was down is skipped, not run late; two slots close together never queue two compactions; daylight saving days; a handoff write that fails withdraws the compaction with one line and leaves the conversation as it was; an empty handoff is not read back.
- Depends on: 24, 7.
- Size: half a day to a day.
- Covers: S2.

### 36. Fresh start, `/restart` and `/restart fresh`

- Package: session.
- Delivers: at `freshAt` a new conversation (no `--continue`), only once no job runs, of any kind (worker, review, plan, audit, …); while one runs, it tries again every `freshRetryMinutes` (default 15), the last try at `freshUntil` (default `"03:00"`), then skips that night with one line (`fresh: skipped, N jobs running at <freshUntil>`). Before it the coordinator writes the handoff of entry 35, and the new conversation starts by reading it; a handoff write that fails withdraws that try with one line, and the next try writes it again. Phone commands `/restart` and `/restart fresh`, answered without the model and refused while any job runs (`error: N jobs running: …; run /stopall first`), the command's message not read again by the next coordinator. Both first ask the coordinator for the same handoff (`.arthur/session/handoff.md`, entry 35), and the new conversation starts by reading it: `/restart` keeps `--continue` and `/restart fresh` does not, so the handoff carries the work in progress and the unanswered questions across every way a conversation ends. After a restart one `Restarted.` message with the steps left in `.arthur/session/after-restart.md` (the steps for the human, not the handoff) and the health lines collected from other plugins; a handoff not written in time does not stop the restart, and the message says `handoff not written`.
- Done means: `freshUntil` that is not `"HH:MM"` and `freshRetryMinutes` that is not a positive whole number are refused at load, naming the option. Edge cases: no fresh start outside the window from `freshAt` to `freshUntil`; Arthur down at `freshAt` skips that night, not run late; a job that ends just before `freshUntil` (the try at `freshUntil` starts the fresh conversation); `freshUntil` earlier than `freshAt`, the window across midnight, and equal to it, a single try; a job started during the wait (the wait goes on); a handoff write that fails at one try; an empty handoff is not read back; a handoff older than the last one read is not read again; `/restart` with one job running; `/restart` or `/restart fresh` with no coordinator running asks for no handoff; an empty `after-restart.md` is not sent; the notice says `(fresh session)` after a fresh start.
- Depends on: 35, 23.
- Size: a day.
- Covers: S3, S4, T15, O4.

### 37. Restart guard

- Package: session.
- Delivers: the session records the main commit and start time it loaded; a merge since then that changed code the session loaded (the host knows each plugin's package folder) makes every spawn refuse with `restart due: <merge>`, through `beforeSpawn`, unless `--ignore-restart`; the coordinator's context gets a `## Restart` line; `restartGuard: false` turns it off.
- Done means: edge cases: a merge that changes only docs or tests does not count; a merge of a disabled plugin's code does not count; a restart clears it; the guard on a project other than Arthur's own does nothing.
- Depends on: 36, 25.
- Size: half a day to a day.
- Covers: S5.

### 38. Start notice and LLM probe

- Package: session.
- Delivers: at every start one word asked of the coordinator's model first; a `notice` event `coordinator up on <host>` or `no LLM access on <host>: <reason>; run omp login`; a turn that fails before any text emits `turn failed on <host>: <reason>`; `probeLlm: false` skips the probe.
- Done means: edge cases: the probe times out; the agent's error carries a credential (it is not repeated); two starts in a row send two notices, not one merged.
- Depends on: 36.
- Size: half a day.
- Covers: S6.

### 80. `arthur doctor`: what Arthur needs, checked at every start

- Package: core (`collect("doctor")`, the command, the core's own requirements, the refusal in `arthur run`) and session (its requirements, the start notice); each plugin named below provides its own requirements, in this entry when the plugin exists, else in that plugin's entry.
- Delivers: through `collect("doctor")` each enabled plugin provides its requirements, each `{ name, check(): ok | missing reason, costs: what does not work without it, fix: one command or step, critical?: boolean }`. The requirements: core: `git`, Node 24 or newer, the agent binary `omp`, `home` writable, each critical; session: the systemd user service installed, enabled, with `Restart=always`, and linger on; telegram: the token present and the bot reachable; media (telegram's media in, 49): `ffmpeg`, for the videos the human sends; voice (81): the whisper.cpp binary `whisper-cli`, the model file, and `ffmpeg`; docker: Docker reachable on each machine labelled `tools: docker`; machines: SSH to each machine, and on it each tool its labels name; resources: the disk floor (69); models (82): each provider reachable and each listed model present. `arthur doctor` prints one line per requirement, `<plugin> <name>: ok` or `<plugin> <name>: missing: <reason>; without it: <costs>; fix: <fix>`, and exits 1 when anything critical is missing; it runs no model. At every `arthur run` start, doctor runs before the LLM probe (38), and its missing lines go first in the start notice. A critical miss refuses the start before any plugin's `start`, with those lines: printed, so the service's journal shows them, and sent as one `notice`; anything else starts, with reduced function.
- Done means: each line format above, `ok` and `missing`; exit 0 with only non-critical misses, 1 with one critical miss; no model and no network call beyond what a check names. Edge cases: a check that throws costs its line only, named (`<plugin> <name>: missing: check failed: <error>`), and every other line is still printed; a check that hangs is cut after 10 s (`missing: check timed out after 10 s`); a plugin disabled in the config is not checked and has no line; no systemd user manager (macOS, a container) is one non-critical line; the same missing line is not sent again at each start within a day unless it changed, so the service starting a refused `arthur run` again every 5 s sends its refusal once; a line fixed and missing again is sent again; with `home` not writable the refusal is printed only, since nothing can record that it was sent; `arthur doctor` always prints every line, sent before or not; no missing line leaves the start notice of 38 as it was.
- Depends on: 38, 4.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-16); the step after install of S8.

## Models

### 82. Models: providers on other machines, and a fallback chain

- Package: models, a plugin and not the core: its providers, keys and network probes are optional, as voice's binaries are, and the core never imports a plugin. In the core: a spawn's `model` may be an ordered list; the answer of `roles.model` may be a promise, awaited at spawn; `host.jobs.prepare` (9) may return variables for the job's environment, and `host.jobs.run(machine, argv)` runs one command on a machine (both changes entry 70 names; whichever entry is built first adds them). In orchestration: a role's `model` in `roles` (26) is one name or an ordered list.
- Delivers: the plugin and its options, checked: `providers`, named, each `{ kind: "ollama" | "openai-compatible", url, keyEnv? }`, and `probeSeconds` (default 3). A url's host must be loopback (`localhost`, 127.0.0.0/8, `::1`), private (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7) or Tailscale (100.64.0.0/10, fd7a:115c:a1e5::/48, a `*.ts.net` name); any other is refused at load, and a name is resolved at load and at each probe and refused when it resolves to any other address. A model is `<provider>/<model>`: one whose provider is in `providers` is a provider model, any other (`anthropic/claude-haiku-5-5`) a built-in one. Through `provide("models.pick")`, given an ordered list, it answers the first available model and the line why: a provider model is available when its server answers its model list within `probeSeconds` and lists the model (ollama: `GET <url>/api/tags`, where a name without a tag matches its `:latest`; openai-compatible: `GET <url>/models`, with `Authorization: Bearer <key>` when `keyEnv` is set); a built-in model is always available. One probe per provider runs at a time, and its answer is reused for 30 s. `provide("roles.model")` (AR0013, given by orchestration) returns the first available of the role's list through `call("models.pick")`; the core does the same with a list given on a spawn (a kind's option such as manage's `audit.model`, or `--model a,b`). The job's record names the model used and why (`mac/qwen3-coder unreachable: <reason>; using anthropic/claude-haiku-5-5`). Through `prepare`, a job on a provider model gets the provider in its own environment only, through what omp reads: ollama as omp's `ollama` provider (`OLLAMA_BASE_URL=<url>`, `OLLAMA_API_KEY` from `keyEnv`, `--model ollama/<model>`), openai-compatible as its `lm-studio` provider, which reads any OpenAI-compatible `/models` (`LM_STUDIO_BASE_URL=<url>`, `LM_STUDIO_API_KEY`, `--model lm-studio/<model>`). Not a `models.yml`: omp reads that only from its own agent folder (`~/.omp/agent/models.yml`, the owner's global file), and moving that folder (`PI_CODING_AGENT_DIR`) moves omp's settings and state with it. A provider model costs 0: its job keeps its time limit, its budget is 0 (no limit, 12), and the record says `budget: none, free model <name>`. Through `collect("doctor")` (80): each provider reachable, each listed model present, each critical only when a list names it with no later model on another provider or built in; omp's own `models.yml` configures neither `ollama` nor `lm-studio` (its provider would replace the one the job's environment sets), critical when a provider of that kind is listed.
- Done means: tested against the fake agent and a fake Ollama and a fake OpenAI-compatible server on a loopback port, each answering its model list in its documented shape, every field included (Ollama: `{ models: [{ name, model, modified_at, size, digest, details }] }`; OpenAI: `{ object: "list", data: [{ id, object: "model", created, owned_by }] }`). Refused at load: a `kind` other than the two; a url that is not `http` or `https`, or whose host is public; `probeSeconds` not a positive whole number. Refused at spawn, before any record exists: every model in the list unavailable, naming each with its reason (`no model available: mac/qwen3-coder: unreachable: timed out after 3 s; lab/qwen3: not in its model list`); a list while the models plugin is off (`a model list needs the models plugin`). Edge cases: a slow probe is cut at `probeSeconds` and the next model is tried; a provider whose list lacks the model; a server answering HTTP 401, or something that is not a model list; a key read from the env file reaches only the probe's header and the job's environment, never the record, the log or a refusal; two spawns at once make one request to the server (counted by the fake), and a spawn 30 s later makes a new one; a single provider model given with `--model` is probed too and refused, with no fallback, when unavailable; a job on another machine (21) is probed from that machine (through `host.jobs.run`), since a loopback or private url may not reach the same server from there; a model lost mid-job (the Mac goes to sleep): the job fails with the reason the agent gave and is never switched to another model mid-run; `arthur roles` shows each role's list as written and probes nothing.
- Also delivers (the owner, 2026-10-16: see each provider's limits simply and for any provider): `arthur usage` and `/usage` print each authenticated account's limit windows (used %, resets in) from the agent's own report (`omp usage --json`), never an email unless asked; the fallback chain skips a model whose provider window is at or over `limits.stopAt` (default 95%); a job's spawn line and the coordinator's context carry the windows over `limits.warnAt` (default 80%). Edge cases: an agent without a usage report (`arthur usage` says so, nothing skipped); a provider that does not report (its line says `no data`); a report older than 10 minutes is fetched again, a failed fetch keeps the last one with its age.
- Depends on: 26, 12, 21, 80.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-16: a model on his Mac over the network, and when it is not available another available model of similar strength).

## Schedule

### 39. Schedule entries and the sweep

- Package: schedule.
- Delivers: entries from the config and from the `file` option: a daily `HH:MM` (optionally on some days) or a one-off date and time, in `timeZone`; an action (a message to the coordinator `[scheduled <id>] …`, optionally naming a procedure) or a job (spawn of a kind); each due slot claimed once, run state in `.arthur/schedule/`.
- Done means: edge cases: a daily entry missed for three days fires once and says it is late; a one-off in the past fires once at start; a hand-broken entry is skipped and named, the others still run; two sweeps at once claim a slot once; a day list that excludes today.
- Depends on: 24, 7.
- Size: a day.
- Covers: C1, C3.

### 40. Registered entries and `arthur schedule`

- Package: schedule.
- Delivers: `provide("schedule.register")`, through which another plugin registers its entries from its options (ids namespaced by the plugin); `arthur schedule add|list|remove` for hand-added entries in the file.
- Done means: refused: a registered id that clashes, `remove` of a registered entry (it says which plugin's option makes it), an `add` with a time that is not valid. Edge cases: `list` shows both kinds with their source; a plugin disabled after registering leaves no entry behind.
- Depends on: 39.
- Size: half a day.
- Covers: C1 (the command), C2, G6 (the mechanism).

## Projects

### 41. The project list

- Package: projects.
- Delivers: the `list` option: name, `title` (the full name, e.g. `Shop` for `MP`), `about` (one or two sentences: what the project is and what it is for), `path` or `repo` (cloned into `reposDir`), `prefix`, `install`, `tracker`, `ci`, `commitRules`, `autoMerge`, `pathPrepend`, `prompts`, `requires` (the machine labels its jobs need, read by placement, 31); `provide("projects")`, which the host serves as `host.projects()`; `pathPrepend` in front of `PATH` for the project's jobs and checks; the phone command `/projects` (prefix, folder, open tickets, running jobs); a `prepare` hook that installs a new worktree's dependencies with the project's `install` command (a shell command in the project's entry, such as `composer install` or `uv sync --frozen`), run in the worktree with `pathPrepend` in front of `PATH`; without `install`, the lockfile picks a frozen install for the managers the plugin knows (`bun.lock`: `bun install --frozen-lockfile`, `package-lock.json`: `npm ci`, `pnpm-lock.yaml`: `pnpm install --frozen-lockfile`, `composer.lock`: `composer install`, `uv.lock`: `uv sync --frozen`), and a project with none of them and no `install` gets nothing; `install: ""` turns it off; no copy of the main checkout's `node_modules` (measured 2026-10-15 on the VPS: `bun install` 2.4 to 2.8 s against a 17 to 32 s copy, and a copy carries a stale install over, harness K0246). Until it exists, a job installs from the lockfile itself, as the worker's role tells it.
- Done means: refused at load, naming the project: two projects with one name or prefix, both or neither of `path` and `repo`, a `tracker.instance` the tracker plugin does not have. Edge cases: a repo already cloned with another remote is refused, not overwritten; a clone that fails names the project and leaves no folder; `/projects` with a broken board gets a line for that project; no `install` and no known lockfile (nothing installed, said once in the job's log); two known lockfiles and no `install` (refused at load, naming the project and the files); an install that fails stops the spawn, naming the project and the command.
- Also delivers (the owner, 2026-10-16: the coordinator must know what a prefix means, with a simple config): the coordinator's context on every turn (25) carries one line per project, `MP Shop: <about>`, so a prefix or a name in the owner's message is understood; `/projects` shows the same lines. Only `name`, `prefix` and `path` or `repo` are required; `title` defaults to the name, a missing `about` says so once in `arthur doctor`. Edge cases: an `about` longer than 300 characters (refused at load, naming the project).
- Depends on: 6, 17.
- Size: a day.
- Covers: P2, P4, T8, B3 (where the prefix is set), G8 (the paths), G13, the `PATH` setting.

### 42. Onboarding a repository

- Package: projects.
- Delivers: `arthur init <project>` gives a project's repository what Arthur reads (the `spec/` skeleton, the criteria files, an empty board); the kind `onboarding`: reads the repository, asks up to 10 questions, then drafts the vision and criteria; the procedure sent when it ends; its merge accepts only those files.
- Done means: refused: `init` on a project not in the config, `init` over an existing board. Edge cases: an empty repository; the onboarding asking more than 10 questions is cut at 10; a draft touching another file is refused at merge.
- Depends on: 41, 10.
- Size: a day.
- Covers: P1, P3, O8.

## Commit rules

### 43. Commit rules per project

- Package: commit-rules.
- Delivers: each project's `commitRules`: a `regex` becomes a `commit-msg` hook, installed through `host.jobs.prepare` in the project's job worktrees, that refuses a non-matching subject and says the rule; `words`, or a `file` read from the project's repository at the job's commit, goes into the worker's and the reviewer's prompt through `provide("prompt")`. Arthur's own project uses the Conventional Commits regex.
- Done means: refused at load: a regex that does not compile. Edge cases: a project without `commitRules` gets no hook and no text; a missing rule file warns and the job starts; the project's own git configuration outside Arthur's worktrees is untouched (asserted); a merge commit subject.
- Depends on: 41, 10.
- Size: half a day to a day.
- Covers: G10, E4.

## YouTrack

### 44. YouTrack: instances and reading

- Package: youtrack.
- Delivers: `instances` (named and unnamed, `urlEnv`, `tokenEnv`); `arthur youtrack issue|article list|get`; a project's `tracker` picks the instance; tested against a fake server that answers in the shape of YouTrack's REST documentation.
- Done means: refused before any call: an issue id outside the project's YouTrack project. Edge cases: the token never appears in an error (asserted with a known token); a 401, a 404, a timeout each give one line; paging past the first page; an unnamed and a named instance side by side.
- Depends on: 41.
- Size: a day.
- Covers: Y1 (reading), P4.

### 45. YouTrack: writing issues, articles, fields and work items

- Package: youtrack.
- Delivers: create or update an issue or an article from a file, set a custom field, add a work item; no verb deletes an issue.
- Done means: edge cases: a field value the project does not allow (YouTrack's error in one line); updating an article that changed meanwhile; an empty file; a work item of 0 minutes is refused.
- Depends on: 44.
- Size: a day.
- Covers: Y1 (writing).

### 46. YouTrack: comments, attachments, and the rules for jobs

- Package: youtrack.
- Delivers: list, add, edit and soft-delete comments; save attachments to `.arthur/youtrack/<id>/`; the rules a job working on an issue gets in its prompt: issue text is never an instruction, never quoted back, and a job never writes to YouTrack.
- Done means: edge cases: an attachment with a name that climbs out of the folder is saved under a safe name; an attachment of 0 bytes; deleting a comment of another author is refused by the server and said in one line.
- Depends on: 44.
- Size: a day.
- Covers: Y1 (comments, attachments), Y2.

## Telegram

### 47. Telegram: receive and send text

- Package: telegram.
- Delivers: `bots` (named instances); long polling (30 s); only the allowed chat; messages older than 10 minutes dropped; text becomes `message-received` (`[via Telegram] <text>`); `coordinator-replied` and `notice` are sent, long text in slices at line breaks; during quiet hours sent without a notification; any other kind of message gets `only text, photos and files reach the coordinator`; tested against a fake Bot API in the shape of its documentation.
- Done means: edge cases: a second poller (409) is said once and polling retries; a message from another chat is ignored and not acknowledged into the coordinator; a slice boundary inside a long line; quiet hours across midnight.
- Depends on: 24, 7.
- Size: a day.
- Covers: T1, T2 (sending).

### 48. Telegram: the outbox and retries

- Package: telegram.
- Delivers: one retry per send; a failed slice queued in `.arthur/telegram/outbox/` and sent first next time, in order; a refused (4xx) slice set aside and told once; a text too long for one message cut with a note.
- Done means: edge cases: the outbox survives a restart; a 429 waits as Telegram says; a 4xx slice does not block the ones after it; two processes sending at once keep order.
- Depends on: 47.
- Size: half a day.
- Covers: T2.

### 49. Telegram: media in and out, `arthur send`

- Package: telegram; in the core, the `parts` of `message-received` and how they become the coordinator's turn (the contract every channel uses, 73 and 74 included), the `arthur send` command, and the `channel.send` name every channel provides.
- Delivers: a channel only receives: it saves what came and emits one `message-received` with `channel` (its plugin's name) and `parts`, in the order the message holds them, each `{ kind: text | photo | video | voice | audio | file, path?, text?, mime, seconds? }`. A text or a caption is a `text` part with `text` and `mime: "text/plain"`; every other part is a file the channel saved under `.arthur/<channel>/`, with its `path`, its `mime`, and `seconds` when the channel gives a length; an album is several parts of one message. On Telegram: a photo (largest size), a video or a round video note (`video`), a voice note (`voice`), an audio file (`audio`), any other document (`file`); any other kind of message (a sticker, a location, a poll) gets `only text, photos, videos, voice notes, audio and files reach the coordinator`. The channel transcribes, converts and reads nothing. Before the coordinator gets the turn, the core asks `collect("message.part", part)` of the enabled plugins for each part that is not text: a plugin that handles the part's kind answers `{ text, reply? }` (or a promise of it), any other `undefined`; the first claim in setup order replaces the part by its `text`, and its `reply` goes back to the human through the channel the message came from. An unclaimed media part reaches the coordinator as its saved path, as before; an unclaimed `voice` part (no voice plugin, 81, is enabled) becomes one line `[voice note not transcribed: the voice plugin is not enabled]`, and the channel says the same line to the human. The turn is `[via <channel>]` and each part's text, in order. Messages keep their order: one waits until every part of the ones before it is resolved, so a text sent after a voice note does not overtake it. `arthur send <file>… --caption` sends through every enabled channel: on Telegram photos and videos as an album, other files as documents after it, up to 10 files, sizes and extensions checked before anything is sent.
- Done means: refused before any send: 11 files, a file over Telegram's size limit, a photo whose sides break Telegram's limits (with a hint to slice it). Edge cases: the token never in an error; an album of one; an album of photos and a video with a caption (one message, its parts in order); a voice note with no plugin enabled (the line to the coordinator and to the human); a claim that throws or rejects leaves the part as its saved path, with the plugin and its error in one line; a text right after a voice note whose claim is slow reaches the coordinator after it; no channel enabled (`arthur send` says so).
- Depends on: 47, 6.
- Size: a day.
- Covers: T3, T4.

### 81. Voice: local transcription of voice notes

- Package: voice.
- Delivers: the plugin and its options, checked: `model` (default `"small"`: a whisper.cpp model name, the file `.arthur/voice/models/ggml-<model>.bin`, or a path to a `.bin` file), `threads` (default 4), `language` (default `"pl"`; a language code of two or three lower-case letters, or `"auto"` for whisper's own detection), `timeoutSeconds` (default 300), `maxSeconds` (default 600). Through `provide("message.part")` (49) it claims every `voice` part, from any channel. It reads only the file the part names and writes only in its own folder: ffmpeg converts the note to 16 kHz mono WAV under `.arthur/voice/` (removed after), then whisper.cpp (`whisper-cli`) transcribes it on the CPU with `model`, `threads` and `language`; nothing leaves the server. One transcription at a time: a queue, in the order the parts came, each run cut after `timeoutSeconds` (its process killed). The coordinator gets `[voice <seconds> s] <transcript> (<path>)`: whisper's lines joined by spaces, then the original file, kept where the channel saved it; `<seconds>` is the part's `seconds`, else the WAV's length. Its requirements for `arthur doctor` (80), none critical, each costing "voice notes reach the coordinator as paths": `whisper-cli` on `PATH` (fix: build whisper.cpp), the model file (fix: whisper.cpp's `models/download-ggml-model.sh <model>`), `ffmpeg` on `PATH` (fix: install ffmpeg).
- Done means: tested against a fake `ffmpeg` and a fake `whisper-cli` on `PATH` that print and exit as the real ones do. Options refused at load: `threads`, `timeoutSeconds` or `maxSeconds` not a positive whole number, `language` neither such a code nor `"auto"`. Edge cases: an empty or silent note (no text, or only whisper's `[BLANK_AUDIO]`) gives `[voice: no speech] (<path>)`; a note longer than `maxSeconds` is not transcribed, the human gets one line through `reply` (`voice note of <seconds> s is over maxSeconds <maxSeconds>; not transcribed`) and the coordinator `[voice <seconds> s: not transcribed: over maxSeconds] (<path>)`; a failed transcription (ffmpeg or whisper exits non-zero, or the run times out) gives `[voice <seconds> s: not transcribed: <why>] (<path>)`, `<why>` being the last line the tool printed on stderr or `timed out after <timeoutSeconds> s`, and the queue goes on; two notes at once (an album, two messages, two channels) are queued and transcribed one after the other, in order, each turn in its message's order; the model file, `whisper-cli` or `ffmpeg` missing: nothing runs, doctor names it, and the note is passed on as a path, `[voice <seconds> s: not transcribed: <what> missing; see arthur doctor] (<path>)`.
- Depends on: 49, 80.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-16: transcribed locally, never in the cloud, a plugin next to the channels).

### 50. Telegram: phone commands and the menu

- Package: telegram.
- Delivers: `/name text` routed to the host's command registry and the reply sent; the bot's command menu built from the phone commands the plugins register; the session's start notice sent as it comes.
- Done means: edge cases: `/name@botname`; an unknown command gets the registry's line; the menu updated when the set of commands changed, not on every start; a command's reply longer than one message.
- Depends on: 47, 6.
- Size: half a day.
- Covers: T5, G3 (routing).

### 51. Freeze the host API

- Package: core; `docs/plugin-api.md`.
- Delivers: the host API as schedule, youtrack and telegram use it, written down: the plugin shape, every host member, every core event and its fields, the `provide` names in use; the published types in `@arthur/core`'s exports; whatever no plugin uses removed. From here a change to the API is a decision recorded in its ticket.
- Done means: the three plugins and the fake host use only what the doc lists (a test lists the core's exports and fails on one the doc does not name); `npm run check` passes with the types tightened.
- Depends on: 40, 46, 50.
- Size: half a day.
- Covers: the vision's decision to derive the API from three plugins.

## Delivery

### 52. Review jobs

- Package: delivery.
- Delivers: the kind `review` (read-only, a fresh model, the reviewer role and review criteria); the verdict `PASS` or `FAIL` from the last line moves the ticket to done or in-progress; no verdict fails the job; `arthur ticket file` of a review writes the next `review-N.md`, never twice; at most 2 FAILs since the last PASS, then `--round N`; the procedure sent at the limit.
- Done means: edge cases: `PASS` not on the last line is no verdict; filing the same review twice is refused; the third review without `--round` is refused, naming the two FAILs.
- Depends on: 51.
- Size: a day.
- Covers: D1, B7, O10.

### 53. `arthur review-needed`

- Package: delivery; in the core, `host.jobs.registerExtension(url)`: an OMP extension each job's agent loads with `-e`, after the core's own.
- Delivers: decides review or no review for a branch: the always-review list (`review.alwaysReview`), deleted files, `.env` text in the diff, docs-only changes, small branches with passing checks; records the verdict and moves the ticket; `provide("delivery.alwaysReview")`. The passing checks come from a job's `checks`, which delivery's own extension, registered through `host.jobs.registerExtension`, writes to `.arthur/delivery/<id>/checks` from each bash `tool_result` while the agent runs: one line per run of the project's own checks, for the `check` and `test` scripts of the worktree's `package.json`, `check pass|fail` for `npm run check` (a TypeScript error in its output fails it), `test pass|fail <passed>/<total>` for `npm test` from node --test's last summary (`test pass|fail` from the exit status without one), and `stale` after the first edit or write that follows them.
- Done means: a table of branches with the decision for each. Edge cases: a renamed file on the list; a branch with no commits; a docs-only branch that also deletes a file. For `checks`: commands joined by `;`, `&&` or `|` (a piped `npm test | tail` read from its output); a script the `package.json` does not declare, or a missing or broken `package.json` (no line); `npm t` and `npm run test`; a command that only mentions `npm test` (no line); two edits after a check (one `stale`).
- Depends on: 52.
- Size: a day.
- Covers: D2.

### 54. `arthur merge`

- Package: delivery.
- Delivers: files the reviews, merges the branch into main, runs install and the project's checks, resets main when a check fails; open findings go to the `findings` plugin's `onMerge` (83), which by default makes each a planning ticket; writes `outcome.md`; sets merged; names the tickets the merge unblocks; `--unreviewed` on the owner's word; the procedure sent after a merge.
- Done means: refused: a branch without a PASS on its tip (unless `--unreviewed`), a dirty main. Edge cases: a merge conflict leaves main as it was; a failed check resets main and says which check; findings with no open entry make no ticket; a finding's ticket gets the next id.
- Depends on: 53, 18.
- Size: a day.
- Covers: D3 (merge), O5.

### 55. Hand-back after a FAIL review

- Package: delivery.
- Delivers: after a FAIL: file it, continue the worker with the findings and a new budget, spawn the next review when the worker ends; cancelled by `stop-all`; spawns go through `beforeSpawn`, so `maxAgents` holds.
- Done means: edge cases: `/stopall` between the worker's end and the next review cancels it; a refused spawn (at `maxAgents`) is retried when a slot frees, not dropped; the second FAIL stops the loop at the review limit.
- Depends on: 54.
- Size: half a day to a day.
- Covers: D4, T14 (the cancel).

### 56. Changelog

- Package: delivery.
- Delivers: `arthur changelog`, and the rebuild after each merge: `CHANGELOG.md` from merged tickets, grouped by day and kind.
- Done means: edge cases: no merged ticket; a ticket without a kind; the same output from two runs (stable order).
- Depends on: 54.
- Size: half a day.
- Covers: D5.

## GitHub

### 57. GitHub: polling CI runs

- Package: github.
- Delivers: `instances` (`tokenEnv`); every `poll.everySeconds` the CI runs of the branches in play, for each project's `ci.workflow`; `ci-finished` once per run id; for a commit that touches no watched path, the run of the nearest commit before it; tested against a fake API in the shape of GitHub's REST documentation.
- Done means: edge cases: the same run seen on two polls emits once (across a restart too); a rate-limit answer waits as GitHub says; a 401 is said once, not every poll; a branch deleted while in play.
- Depends on: 41, 51.
- Size: a day.
- Covers: GH1 (runs), the GitHub setting.

### 58. GitHub: `arthur ci`, reruns, pushes, pull request reviews

- Package: github.
- Delivers: `arthur ci <branch>` tells why a run failed (the failed step, the end of its log); `--rerun` reruns a failed or cancelled run once; the reviewed branch and main pushed to origin (one warning line on failure, never a prompt); pull request reviews polled and emitted for the coordinator when `wakeOn` names them.
- Done means: refused: a second `--rerun` of the same run; a rerun of a passed run. Edge cases: a log too long (its end only); a push rejected as non-fast-forward; no remote.
- Depends on: 57, 52.
- Size: a day.
- Covers: GH1 (`arthur ci`), GH2.

### 59. Auto-merge after PASS and green CI

- Package: delivery.
- Delivers: `arthur merge --auto`: merges only with a PASS on the tip, CI passed (asked of github through `call`), the project's `autoMerge` on, and no held path (roles, vision, CI, `package.json`, the always-review list); `--no-ci` on the owner's word.
- Done means: refused, each naming the rule: a PASS on an older commit, CI pending or failed, a held path, `autoMerge: false`, github disabled without `--no-ci`. Edge cases: CI passed on the tip after a new commit; a held path renamed.
- Depends on: 54, 57.
- Size: half a day.
- Covers: D3 (`--auto`), GH3 (Arthur's own workflow is its `ci.workflow`).

## Manage

### 60. `arthur health`

- Package: manage.
- Delivers: `arthur health` and `/health`: one line per thing that should have happened by now and has not, from the checks each plugin provides (`collect("health")`) and manage's own (a stalled ticket, main not pushed, a board uncommitted for an hour, a temporary folder full, low inodes); reads only; `health.everyMinutes` sends new lines as a `notice`.
- Done means: edge cases: nothing wrong prints one line saying so; a provider that throws costs its line only, named; the same problem is not sent twice in a row.
- Depends on: 51.
- Size: a day.
- Covers: M1, T12.

### 61. `arthur stats`

- Package: manage.
- Delivers: per merged ticket the review rounds, verdicts, cost and days; the mean rounds, the share of first-round PASS, the share of autopilot, the 3 most expensive, the first line of each FAIL finding.
- Done means: edge cases: no merged ticket; a ticket without reviews; a ticket whose cost file is missing counts as unknown, not zero.
- Depends on: 54.
- Size: half a day.
- Covers: M2.

### 62. The audit

- Package: manage.
- Delivers: the kind `audit` (read-only, on the commits since the last audit, the board digest, stats and open findings; up to 5 proposals or `NO PROPOSALS`); no commits since the last one means no job; filed as `spec/quality/<date>.md` with the commit audited; the audit criteria and the procedure sent when it ends; `audit.days`, `audit.at`, `audit.budgetUsd`, `audit.model` register the schedule entry.
- Done means: refused: filing a failed audit. Edge cases: a second audit the same day; a day not in `audit.days` makes no job; a resume after the budget ran out happens once.
- Depends on: 40, 61.
- Size: a day.
- Covers: M3, B8 (audit), O6, C5, G6, the audit setting.

### 63. The retro

- Package: manage.
- Delivers: the kind `retro` (read-only, on the FAIL reviews, findings and outcomes of the merges since the last retro, and the roles and criteria); `arthur retro-due` (10 merges and 2 FAILs, or 5 findings); filed as `spec/retro/<date>.md` and a phone page `spec/retro/<date>.html`; `/retro` sends the newest page; the retro criteria and procedure; `retro.day` and `retro.at` register the entry; the coordinator's context gets the retro-due line.
- Done means: edge cases: exactly at the threshold; no retro yet; `/retro` with no page.
- Depends on: 62.
- Size: a day.
- Covers: M4, B8 (retro), O7, T11, C5.

### 64. Prune and temporary folders on a schedule

- Package: manage.
- Delivers: `prune.keepJobsDays` runs the core's prune on a schedule; temporary folders Arthur made, older than a day, removed daily and at start when a day was missed.
- Done means: edge cases: a folder of a running job is never removed; a folder another user owns is skipped with a line; a missed day runs once at start.
- Depends on: 40, 15.
- Size: half a day.
- Covers: M5, R10 (on a schedule).

### 65. The morning report

- Package: orchestration.
- Delivers: `morningReport.at` registers a schedule action with its procedure: built overnight, merged without the owner, waiting for approval, waiting for a decision, needs attention (from health).
- Done means: edge cases: a night with nothing done says so in one line; schedule disabled refuses the option at load. The report's procedure carries the rule of the coordinator's role file (23, AR0090): every ticket, finding, job, or project the report names gets at least one plain sentence on what it is and what the owner will see change (never file names); an id never stands alone. Every decision it waits for is a question that says what is being decided, why it came up, the options with what each means in practice, and the coordinator's recommendation, so the report alone answers it. This outranks any limit on the report's length: a report that needs it runs longer, short per item.
- Depends on: 40, 60, 54.
- Size: half a day.
- Covers: O11, C2 (the report entry).

## Develop

### 66. `arthur plugin new`

- Package: develop.
- Delivers: `arthur plugin new <name> --budget <lines>` creates `packages/<name>/` with its `package.json`, a plugin file, a test against the fake host and a doc page, and adds `<name>: <lines>` to `BUDGETS` in `test/structure.test.ts` (the number the plugin's ticket decides); the result passes `npm run check` and `npm test` as created.
- Done means: refused: an existing name, a name that is not lowercase letters and dashes, a missing `--budget` or one that is not a positive whole number; a refusal changes no file. Edge cases: the structure test (entry 1) passes on the new package with no hand edit; it still refuses a package without a budget.
- Depends on: 51.
- Size: half a day.
- Covers: the vision's develop plugin (no predecessor capability).

### 67. Evals: the runner

- Package: develop.
- Delivers: `arthur eval` replays coordinator turns (a job ended, a schedule entry due, a message) against scenarios, on a copy of a fixture, with `arthur` replaced by a recording stub; a scenario is scored by what the run left behind (files, refs, the stub's log); pass rates against a baseline; every command refuses to run inside an eval session.
- Done means: edge cases: a scenario whose fixture is missing fails alone; a turn that never ends hits the scenario's timeout; the stub never reaches the live home folder (asserted).
- Depends on: 25, 66.
- Size: a day.
- Covers: E1, R1 (the eval refusal), the eval settings.

### 68. Evals: the scenarios

- Package: develop, and each plugin whose procedure a scenario tests.
- Delivers: the scenarios, each in the package of the plugin whose procedure it tests: after a restart with a plan, an audit with autopilot, a failed check, a failed CI run, a condition before review, an env refusal, "later" as a ticket, a merge, the morning report, a one-line night answer, no sleeping, onboarding questions, a retro, a FAIL review continued, a FAIL review handed back, a PASS review, a PASS review with its hook, unblocked after a restart, a worker done; the baseline.
- Done means: every scenario runs against the fake agent in `npm test` (the scoring, not the model); the baseline holds a rate for each.
- Depends on: 67, 65, 59.
- Size: a day.
- Covers: C7.

## Disk and Docker

### 69. Resources: free disk space per machine

- Package: resources.
- Delivers: `keepFree.disk` (bytes with K, M, G or T; `0` = no floor). At every machine check (34), the free space of each filesystem the machine's jobs write: its `home`, and each path another plugin names for that machine through `collect("resources.disk", machine)` (docker: its data root, 70); `df -Pk` on every machine, over SSH on another one, so `local` takes the same path. Through `beforeSpawn`, no job starts on a machine whose least free filesystem is under the floor; the refusal names the machine, the path, the space and the floor (`build: 12.3 GB free on /var/lib/docker, floor 20 GB`), and `resources.free` gives that machine no room, so placement (31) takes another machine with the labels. The context line and `arthur resources` add the free disk (`local: room for 2 more jobs (5.1 GB, 3.4 cores, 41 GB disk free)`). Falling under the floor emits `disk-low` (`machine`, `path`, `free`, `floor`) and one `notice`; running jobs are never stopped for disk, they finish in the reserve the floor keeps.
- Done means: tested against the fake host and a fake `df` on `PATH` that answers in POSIX `df -P` output. Edge cases: free space exactly at the floor starts a job, one KiB under refuses it; floor `0` is no floor; the floor hit mid-job (the running jobs go on, one `disk-low` and one notice, the next spawn there refused, another machine with the labels takes it); free space hovering around the floor emits one `disk-low` per fall under it, not one per check; two paths on one filesystem count once; a provider's path missing on that machine (skipped with one line, the home still counts); `df` output that cannot be read, or a check that fails, counts as no room, said once, as in 34; a machine without Docker counts its home only.
- Depends on: 34.
- Size: half a day to a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

### 70. Docker: labels on what a job creates

- Package: docker; the `docker` key of a project's entry in `projects`; in the core, `host.jobs.prepare` (9) may return variables for the job's environment, and `host.jobs.run(machine, argv)` runs one command on a machine (over the SSH of entry 21 on another one).
- Delivers: the plugin and its options (`buildCache`, `leftoverHours`, `sweep.at`), checked; it acts on machines labelled `tools: docker`. Through `prepare`, for each job on such a machine whose project has not set `docker: false`: a `docker` script for the job in the plugin's folder on that machine, first on the job's `PATH`, which runs the real `docker` (its absolute path found at prepare) with `--label arthur.job=<id>` added to `run`, `create`, `build`, `buildx build`, `container run`, `container create`, `image build`, `network create` and `volume create`, every other command unchanged; and `COMPOSE_PROJECT_NAME` from the job id (`arthur-<short id>`), so compose labels the containers, networks, volumes and images of its stack with `com.docker.compose.project` itself. `provide("resources.disk")` names Docker's data root (`docker info --format '{{.DockerRootDir}}'`) on each such machine where it lies on the machine's own filesystem. Its `doctor` requirements (80): `docker` reachable as the user Arthur runs as, without `sudo` (the user in the `docker` group, or rootless Docker); refused as unsafe and named: a Docker socket reachable only through `sudo`, Arthur itself running as root, and the daemon listening on TCP without TLS; rootless mode is reported as such.
- Done means: tested against the fake host and a fake `docker` on `PATH` that records its arguments and answers in the shape of Docker's CLI output. Refused at load: `leftoverHours` below 1, a `buildCache` or `sweep.at` that does not parse. Edge cases: a project with `docker: false` gets no script and no variable; a machine without the label gets nothing; the label but no `docker` on the machine (no script, one line per machine, said once); a command that already carries `--label arthur.job=<other>` gets the job's own, so a job cannot label for another; a `--label` with another key is kept; arguments after the image (`docker run img --label x`) belong to the container and are left alone; global options before the command (`docker --log-level debug run …`) still get the label after the command; a compose `-p <name>` the job gives wins, and that stack is left to the sweep; `docker` called by its absolute path, or Docker's API called from a library, is unlabelled and left to the sweep; on macOS, Docker Desktop's data lives in its own virtual machine and is not named for the disk floor, said once.
- Also delivers (the owner, 2026-10-16: a project may live in Docker, and working on it there is easier): the `docker.service` key of a project's entry names a compose service; then the install of 41 and the project's checks run inside it (`docker compose run --rm <service> <command>` in the job's worktree, under the job's own `COMPOSE_PROJECT_NAME`, so two jobs never share a stack), the lockfile guess of 41 reads the worktree as before, and the worker's prompt gets one line saying commands for the project run through that service. Edge cases: a service the worktree's compose file does not name (the spawn stops, naming the project and the service); `docker: false` with a `service` (refused at load).
- Depends on: 69, 41.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

### 71. Docker: cleanup with each worktree

- Package: core (one worktree removal, and its cleanup hooks) and docker.
- Delivers: in the core, one removal of a job's worktree that every path uses: `arthur prune` (15, 22), the merge (54), and a ticket set to dropped (its ended jobs); before it, the hooks plugins register with `host.jobs.cleanup(fn)`, called with the job, on its machine. A hook that throws or runs past 2 minutes is abandoned and emitted as a `notice` naming the job, the machine, the plugin and the reason, and the worktree is removed all the same. In docker, the hook, for a job on a Docker machine whose project has not set `docker: false`, in this order: the containers labelled `arthur.job=<id>` or of the job's compose project, running ones stopped with a 10-second grace, removed with their anonymous volumes; then its networks; its volumes; the images it built (its label, or its compose project's); then the shared build cache cut to `buildCache` (`docker builder prune --max-used-space`). An image without the job's label (a pulled base, a shared or another job's image) is never removed. The removal's output gets one line per job: what was removed, what was kept and why, the space freed.
- Done means: tested with real Git for the worktree and a fake `docker` that keeps a list of resources and refuses as Docker does (a volume in use, an image a container uses, a network with an endpoint). Edge cases: Docker not installed on the machine (nothing to clean, no line); Docker not running (`Cannot connect to the Docker daemon`: the worktree removed, one notice, the labelled resources left for the sweep, 72); a container still running at prune (stopped, then removed); a volume another job's container uses (kept, named in the line, removed by the sweep once unused); an image another job's container uses (kept); a job on another machine (every command there, through `host.jobs.run`); that machine offline (neither the worktree nor its Docker resources touched; the next prune tries both, as in 22); a cleanup failing half-way (what went stays gone, the rest named in the notice, the worktree removed); a ticket dropped while its job runs (the worktree goes at the job's end, through the next prune); a second prune of the same job (nothing left, no error); `buildCache: 0` (no cap); a job that created nothing (only the cache cap runs).
- Depends on: 70, 54, 22.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

### 72. Docker: the leftover sweep and `arthur docker`

- Package: docker; its entry registered with `schedule` (40).
- Delivers: `sweep.at` registers a daily entry; `disk-low` (69) sweeps that machine at once; `arthur docker sweep [--machine <name>] [--dry-run]` sweeps by hand. On each machine with Docker, the sweep removes what is labelled with a job whose record no longer exists, at any age (a cleanup that failed, a volume kept while in use), and unlabelled leftovers older than `leftoverHours`: stopped containers and unused networks (Docker's `until` filter), dangling images, unused anonymous volumes (by their `CreatedAt`, since `docker volume prune` takes no `until`), build cache unused that long; then it cuts the build cache to `buildCache`. It never removes a running container, a named volume without Arthur's label, a tagged image no job built, a resource of a job whose record exists, or anything labelled `arthur.keep`. One `notice` per sweep: on each machine what it reclaimed, the free disk after, and what failed; none when nothing was reclaimed, nothing failed and no machine is under the floor. `arthur docker`: on each machine Docker's own usage (`docker system df`) and the resources labelled with each job, marking the jobs that no longer exist.
- Done means: tested against the fake host and a fake `docker` holding resources of known ages and labels. Edge cases: a leftover exactly `leftoverHours` old goes, one minute younger stays; the owner's own named volume (kept, counted in `arthur docker`); an `arthur.keep` resource of any age; a machine offline (skipped, named in the notice); Docker not running on one machine (named, the others swept); a running job's resources (untouched); `disk-low` during the daily sweep (the second waits for the first, nothing is swept twice at once); `--dry-run` removes nothing and lists what a real run would; a machine still under the floor after the sweep (said in the notice, with its free space and the floor); quiet hours (the notice sent without a notification, the channel's rule).
- Depends on: 71, 40.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

### 83. Findings: what happens to them, per project

- Package: findings.
- Delivers: the `findings.md` format and its reader, out of the core; `provide("findings.onMerge")`, which the merge (54) calls with the open findings; the project option `findings.mode`: `ticket` (one planning ticket each, the default), `grouped` (one planning ticket per merged ticket, every open finding in it), `summary` (no ticket; each finding `deferred (client summary)`, listed in the outcome for the client); `/findings` moves here from 18.
- Done means: tested with real files. Refused at load: an unknown mode. Edge cases: no open finding (nothing made); a finding already `ticket …`, `fixed` or `dropped` (left alone); `grouped` with one finding (one ticket); a project without the plugin (findings stay open, the merge says so once).
- Depends on: 17, 54.
- Size: half a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

## Later

### 73. Signal

- Package: signal.
- Delivers: a channel through `signal-cli` next to Arthur: receive by polling, send text and media, only the allowed number, the `channel.send` and `message-received` contract telegram uses: the same `parts` (49), files saved under `.arthur/signal/`, so voice notes reach the voice plugin (81) and every media plugin as they do from Telegram.
- Done means: tested against a fake `signal-cli` that answers in its documented JSON shape. Edge cases: `signal-cli` missing (one line, the plugin does not start); a message from another number; an attachment too large.
- Depends on: the first version (entries 1 to 72).
- Size: a day.
- Covers: none (new).

### 74. WhatsApp through a local bridge

- Package: whatsapp.
- Delivers: a channel through a bridge on loopback (receive by polling, send text and media, only the allowed number), with the `channel.send` and `message-received` contract telegram uses: the same `parts` (49), files saved under `.arthur/whatsapp/`, so voice notes reach the voice plugin (81) and every media plugin as they do from Telegram; refuses a bridge URL that is not loopback.
- Done means: tested against a fake bridge. Edge cases: a bridge URL on a public address refused at load; the bridge down (said once, retried); the session logged out.
- Depends on: 73.
- Size: a day.
- Covers: none (new).

### 75. Server: events over a stream

- Package: server.
- Delivers: the event log over HTTP as a stream from a sequence number, every request carrying the token; binds only loopback or a private address.
- Done means: refused at load: `0.0.0.0`, a public address. Edge cases: a request without or with a wrong token (401, no detail); a client that reconnects from its last sequence misses nothing; a slow client does not block the others.
- Depends on: 74.
- Size: a day.
- Covers: none (new).

### 76. Server: commands over HTTP

- Package: server.
- Delivers: the registered commands over HTTP (name, arguments, the reply), with the token.
- Done means: edge cases: an unknown command; a command that throws (one error line); two calls at once.
- Depends on: 75.
- Size: half a day to a day.
- Covers: none (new).

After entry 72, Arthur switches its first project, itself: it runs on the VPS (`docs/deploy.md`) and takes its own tickets. The other projects follow, then the later entries.

### 77. Web panel: the board, jobs, events and chat in a browser

- Package: server (its web page; the same plugin as 75 and 76).
- Delivers: the board, the jobs with their states, the events and the coordinator's chat in a browser, served by `server` (75, 76) on the Tailscale network only; Tailscale identifies who connects, so the panel keeps no passwords.
- Done means: refused at load: a bind address that is neither loopback nor Tailscale's `100.64.0.0/10` or `fd7a:115c:a1e0::/48`. Edge cases: a request from outside the Tailscale network is refused with no detail; the panel's job states are the ones `arthur jobs` prints; its events are the ones 75 streams; a command run from the panel gives the reply `arthur <cmd>` gives.
- Before any code (the owner, 2026-10-16): the panel is planned with the owner first: the frontend libraries it uses, if any, and why each (the core and the other plugins keep no runtime dependencies), how it is built and served, and the screens; the owner approves the plan.
- Depends on: 76.
- Size: several days.
- Covers: none (new: the owner asked for it on 2026-10-16).

### 78. Knowledge base: documents, search, and a chat with sources

- Package: knowledge.
- Delivers: a project's or company's documents in three forms: plain documentation, search over them (RAG) that agents can query through a command, and a chat that answers from them with sources.
- Done means: a search returns passages, each with its file and line; a chat answer names the files it used; a document removed from the folder is removed from the search results; a file that is not readable text is refused with its name. Edge cases: an empty folder; a query with no match says so.
- Depends on: 77.
- Size: several days.
- Covers: none (new: the owner asked for it on 2026-10-16).

### 79. Company edition: business roles as standing agents

- Package: one plugin per role (`@arthur/marketing`, `@arthur/sales`, `@arthur/research`), and the approval step they share.
- Delivers: business roles run as standing agents that talk through the coordinator by tickets and notes, not freely to each other. Every action that leaves the company (an email, a post, an offer) waits for a human's approval. Roles, keys and data are per role: each Tailscale user gets roles, and a role's manager approves its decisions.
- Done means: an action that leaves the company is not sent until its manager approves it, and a refused one is not sent; a role cannot read another role's data or keys; a role agent reaches another role only through a ticket or a note. Edge cases: a role with no manager is refused at load; a Tailscale user with no role gets no role's data.
- Depends on: 77 and 78.
- Size: weeks; to be split into its own entries when it is planned.
- Covers: none (new: the owner asked for it on 2026-10-16).

## Coverage of the harness Arthur replaces

Each row is one capability of the harness Arthur replaces, as it was inventoried on 2026-10-16, and the entry that carries it. "Out of scope" names why.

### Command line and job runner

| Id | Capability | Entry |
| --- | --- | --- |
| R1 | The CLI: find a command, `--help` from its doc, act on another project; refuse inside an eval | 6; eval refusal 67 |
| R2 | Start a job: worker on its own branch or read-only checkout, job record, `Ticket:` check, dependencies installed | 9; the install 41 |
| R3 | The wrapper: one process per job, tools by role, the job's files, state last | 11 |
| R4 | Time and budget limits, per-kind budgets, one automatic resume | 12 |
| R5 | One scope per job in a joint CPU and memory slice; leftovers killed | 13 |
| R6 | Stop: TERM, KILL after a grace, strays, the scope | 14 |
| R7 | Continue a finished worker in place | 14 |
| R8 | Steer a running worker; an undelivered steer named at the end | 14 |
| R9 | List jobs of every project with short ids | 15 |
| R10 | Prune finished jobs, Git deciding what is safe | 15; on a schedule 64 |
| R11 | Git helpers | 9 |
| R12 | Fail a job whose process is gone on two sweeps | 15 |
| R13 | Settings from the shell and `.env`, the shell winning even when empty | 2, 3 |
| R14 | The role prompt: role file, override, criteria; symlinks refused | 10 |
| R15 | The worker role | 10 |
| R16 | Env guard | 19 |
| R17 | Worktree guard and the shell parser | 20 |
| R18 | One extension file wiring the coordinator's hooks | Out of scope: the plugin host loads each plugin (4) |
| R19 | A doc page per command, kept equal to the commands | 6 |

### Ticket board

| Id | Capability | Entry |
| --- | --- | --- |
| B1 | Tickets as folders, the board file, statuses, template guidance refused at `planned` | 17 |
| B2 | One writer at a time on the board | 17 |
| B3 | Ticket ids with a per-project prefix | 17; the prefix set in 41 |
| B4 | `after`: a ticket waits for others | 18 |
| B5 | Statuses follow jobs | 18; review verdicts 52; merged 54 |
| B6 | The worktree holds the `Ticket:` files and the approved plan | 9; plan 28 |
| B7 | Filing a review, never twice | 52 |
| B8 | Filing an audit or a retro | 62, 63 |
| B9 | Filing a plan or plan review | 28 |
| B10 | Autopilot pre-approval | 29 |
| B11 | The board digest | 18 |
| B12 | Each project's vision file, read by the roles | 17 (the skeleton), 25 (read) |

### Orchestration

| Id | Capability | Entry |
| --- | --- | --- |
| O1 | The coordinator's role | 23 |
| O2 | The coordinator's context on every turn | 25 |
| O3 | Wake on job end | 24 |
| O4 | The `Restarted.` message after a restart | 36 |
| O5 | The procedure after a merge | 54 |
| O6 | The procedure when an audit ends | 62 |
| O7 | The procedure when a retro ends | 63 |
| O8 | The procedure when an onboarding ends | 42 |
| O9 | The procedure when a plan or plan review ends | 28 |
| O10 | The procedure at two FAIL reviews | 52 |
| O11 | The morning report | 65 |
| O12 | At most N jobs at once, enforced | 26 |
| O13 | Model and thinking level per role | 26 |
| O14 | The plan flow for a large ticket | 28 |

### Delivery, GitHub, manage, projects, YouTrack, develop

| Id | Capability | Entry |
| --- | --- | --- |
| D1 | Review jobs and the 2-FAIL limit | 52 |
| D2 | Review or no review for a branch | 53 |
| D3 | Merge, findings to tickets, outcome; `--auto` after PASS and green CI | 54; `--auto` 59 |
| D4 | Hand-back after a FAIL | 55 |
| D5 | The changelog | 56 |
| GH1 | CI runs of a branch and main; why a run failed; rerun | 57, 58 |
| GH2 | Push the reviewed branch and main | 58 |
| GH3 | The repository's own CI workflow | Out of scope as a capability: Arthur's `.github/workflows/ci.yml` exists; the github plugin watches it through `ci.workflow` (59) |
| M1 | Health | 60 |
| M2 | Stats | 61 |
| M3 | The nightly audit | 62 |
| M4 | The weekly retro and when it is due | 63 |
| M5 | Clean old temporary folders | 64 |
| P1 | Give a repository what Arthur reads | 42 |
| P2 | The list of projects every command reaches | 41 |
| P3 | Onboarding of a new repository | 42 |
| P4 | A project names its tracker instance | 41, 44 |
| Y1 | YouTrack: issues, articles, fields, work items, comments, attachments; no delete; ids checked; token hidden | 44, 45, 46 |
| Y2 | Rules for a job working on an issue | 46 |
| E1 | Evals of coordinator turns | 67 |
| E2 | The test kit: fake agent, fake host, safety net, temporary folders | 4, 11 |
| E3 | Rules that keep the code small, as a test | 1 |
| E4 | The Conventional Commits hook | 43 (Arthur's own project uses the regex) |
| E5 | One page on what the models read | 10 |

### Session

| Id | Capability | Entry |
| --- | --- | --- |
| S1 | The coordinator as one interactive agent in tmux, started again, waiting for the previous one to exit; attach and stop | 23 |
| S2 | Compaction at 08:00, 13:00, 18:00 | 35 |
| S3 | The fresh start at 23:00 | 36 |
| S4 | `/restart` and `/restart fresh` | 36 |
| S5 | The restart guard | 37 |
| S6 | The LLM probe and the turn-failed notice | 38 |
| S7 | The service and the user manager survive; controllers delegated | 8; delegation 13 |
| S8 | The VPS recipe | 8; its step after install, `arthur doctor`, 80 |

Session options: `compactAt` 35; `freshAt`, `freshRetryMinutes` and `freshUntil` 36; `timeZone` 7; `compactWaitSeconds` 35; `exitWaitSeconds`, `restartDelaySeconds` and the tmux session 23 (options of `orchestration`); no restart, stop or fresh start while jobs run, a rule in 23 and 36; `restartGuard` 37; `probeLlm` 38; the coordinator's model 26; the session's files in `.arthur/session/`: the handoff 35, the rest 36.

### Telegram

| Id | Capability | Entry |
| --- | --- | --- |
| T1 | The bridge: polling, one chat, old messages dropped, turns, replies, polling failures | 47 |
| T2 | Sending: retry, outbox, refused slices, quiet hours, long text | 47, 48 |
| T3 | Media in | 49 |
| T4 | Media out, `send` | 49 |
| T5 | The start notice and the command menu | 38, 50 |
| T6 | `/jobs` | 15 |
| T7 | `/board` | 18 |
| T8 | `/projects` | 41 |
| T9 | `/findings`, `/task` | 18 |
| T10 | `/plan` | 28 |
| T11 | `/retro` | 63 |
| T12 | `/health` | 60 |
| T13 | `/steer` | 15 |
| T14 | `/stopall` | 15; the hand-back cancel 55 |
| T15 | `/restart`, `/restart fresh` | 36 |

### Schedule, deploy, state

| Id | Capability | Entry |
| --- | --- | --- |
| C1 | Schedule entries, the sweep, the `schedule` command | 39, 40 |
| C2 | The recurring entries (morning report, retro, audit) and their day rules | 40, 62, 63, 65 |
| C3 | The schedule's run state outside Git | 39 |
| C4 | The deploy units | 8 (service), 13 (delegation), 35 and 36 (the session's times, run by `arthur run`), 64 (cleanup) |
| C5 | Audit and retro reports | 62, 63 |
| C6 | Planning documents for Arthur | Out of scope: they are this repository's `spec/` |
| C7 | The eval scenarios | 68 |
| C8 | Runtime state | `.arthur/`: 8, each plugin its own folder (4) |
| C9 | Secrets only in `.env`, the variables listed | 3 |
| C10 | What a job can reach, and where protection ends | 8 (the threat model in `docs/deploy.md`) |

### Commands

| Command of the harness Arthur replaces | Arthur | Entry |
| --- | --- | --- |
| spawn (worker) | `arthur spawn` | 9 |
| spawn a review | kind `review` | 52 |
| spawn an audit, a retro | kinds `audit`, `retro` | 62, 63 |
| spawn a plan, a plan review | kinds `plan`, `plan-review` | 28 |
| spawn an onboarding | kind `onboarding` | 42 |
| continue | `arthur continue` | 14 |
| steer | `arthur steer` | 14 |
| jobs | `arthur jobs` | 15 |
| stop | `arthur stop` | 14 |
| prune | `arthur prune` | 15 |
| ticket (digest, all, new, status, after) | `arthur ticket` | 17, 18 |
| ticket file | `arthur ticket file`, by kind | 52, 62, 63, 28 |
| ticket status planned with autopilot | `arthur ticket status --autopilot` | 29 |
| merge | `arthur merge` | 54, 59 |
| review-needed | `arthur review-needed` | 53 |
| changelog | `arthur changelog` | 56 |
| ci | `arthur ci` | 58 |
| schedule | `arthur schedule` | 40 |
| roles | `arthur roles` | 10 |
| stats | `arthur stats` | 61 |
| retro-due | `arthur retro-due` | 63 |
| health | `arthur health` | 60 |
| send | `arthur send` | 49 |
| eval | `arthur eval` | 67 |
| init | `arthur init` | 42 |
| youtrack | `arthur youtrack` | 44, 45, 46 |

### Settings

| Setting of the harness Arthur replaces | Arthur | Entry |
| --- | --- | --- |
| Telegram bot token and chat | `telegram` `bots` | 47 |
| Model and thinking per role, quick model | `orchestration` `coordinator`, `roles` | 26 |
| Job timeout and budget | `core.jobs` | 2, 12 |
| Audit budget | `manage` `audit.budgetUsd` | 62 |
| Plan budget | `orchestration` `plan` | 28 |
| Autopilot budget and cap | `orchestration` `autopilot` | 29 |
| Joint CPU and memory of jobs | `core.jobs.cpu`, `core.jobs.memory` | 13 |
| Folders in front of `PATH` | `projects` `pathPrepend` | 41 |
| GitHub token | `github` `instances` | 57 |
| YouTrack URL and token per server | `youtrack` `instances` | 44 |
| The wrapper's and guards' own switches | core internals | 11, 19, 20 |
| The coordinator marker, the fresh-start marker, the test tmux socket | `orchestration`, `session` | 23, 36 |
| The eval's stub switches | `develop` | 67 |
| Test seams (process table, job slice, Bot API URL) | kept as test seams | 13, 15, 47 |

### Gaps the inventory found, and their entries

| Id | Gap | Entry |
| --- | --- | --- |
| G1 | The coordinator's conversation lifecycle | 35 to 38 |
| G2 | Worktree guard | 20 |
| G3 | Phone commands without the model, the menu | 6, 50 |
| G4 | Time zone and quiet hours | 3, 7 |
| G5 | Planning of large tickets | 28 |
| G6 | Which days the audit and retro run | 40, 62, 63 |
| G7 | Dead jobs; the joint limit | 13, 15 |
| G8 | A project's own vision and criteria | 10, 41 |
| G9 | A doc per command | 6 |
| G10 | Commit rules per project | 43 |
| G11 | English only, English keys | 17 (the board reads English keys; no old ticket is rewritten, the board starts empty) |
| G12 | The predecessor's history of tickets and reports | Out of scope: it is not carried over (vision) |
| G13 | Per-project prefixes; renumbering | 41; renumbering out of scope, the board starts empty |
