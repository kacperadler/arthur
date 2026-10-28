# Roadmap

The ordered list of feature tickets that builds Arthur from the core to the plugins (`spec/vision.md`). The coordinator creates one ticket per entry, in this order, and starts an entry once everything in its "Depends on" is merged. Each entry is half a day to a day of agent work.

How to read an entry:

- Package: where the code lives. `packages/core/` is `@arthur/core`; a plugin is `packages/<plugin>/`, `@arthur/<plugin>`.
- Delivers: what it adds, and through which interface (a command, an event, the host API, an option).
- Done means: what a reviewer checks, edge cases included. Every entry also means: its tests run under `npm test` against fakes (the core against a fake plugin and a fake agent, a plugin against the fake host of `@arthur/core/testing`), `npm run check` and `npm test` pass, each command it adds has its doc page, each option it adds is in `arthur.config.example.ts`, once entry 80 is merged, each thing its plugin needs to work (a binary, a token, a reachable service) is a requirement it provides to `collect("doctor")`, and, once entry 93 is merged, each option it adds has its one-line meaning in its package's option table and each binary it runs is in that file's `tools`.
- Covers: the capabilities of the harness Arthur replaces that it carries over, by their id in the table at the end.

Order: the core first, piece by piece, then the first-version plugins in the vision's order, then the later plugins. Within the core the event stream comes right after the plugin host, because the job runner and the board emit into it from their first line. Job state (16) comes right after the job runner it describes, and jobs on another machine (21, 22) after the guards they carry there. Machines and resources (30 to 34) come right after orchestration, whose `maxAgents` and context they build on; placement reads the project list and the per-feature caps read the board through the host, so neither waits for the `projects` plugin. The plugin API is frozen (entry 51) only after schedule, youtrack and telegram use it. Discord (89, 90), the channel the owner uses (AR0134), comes right after the switch (the owner, 2026-10-19), with voice (81) and Docker (70 to 72), so Arthur runs itself on Telegram first; it is built on the frozen API, and its main channel and one channel per project are ready before the project agents (85 to 88) use them. An entry that needs a plugin built later sits after that plugin (the morning report, the auto-merge). Disk and Docker (69 to 72) close the first version, before the switch: the disk floor extends the free resources of 34, the labels read the project list (41), the cleanup runs in the one worktree removal that prune (15) and the merge (54) share, and the sweep registers its entry with schedule (40). `arthur doctor` (80) sits right after the start notice (38), which it runs before, and took the next free number so that 1 to 79 keep theirs; a plugin built after it brings its own requirements. The option tables (93) and `arthur setup` (94) sit right after the project list (41), and after `arthur doctor` (80): `arthur setup` prints doctor's lines and reads the tables, which take over the option checks of orchestration (23) and projects (41); a plugin built after them brings its own table, and they took the next free numbers after 85 to 92, which the approved plan of AR0098 holds. Voice (81) sits right after telegram's media (49), whose `parts` and `message.part` it plugs into, and before the freeze (51), so `message.part` is frozen as a plugin uses it; it took the next free number too. Models (82) sit right after `arthur doctor` (80), whose requirements they add, and after the roles' models (26) and the job limits (12) they extend; they took the next free number too. Discord (89, 90) and the later channels (73, 74, 91, 92) use the same `parts`, so every media plugin works with them unchanged. The later entries follow the order the plan of AR0098 recommends: project agents (85 to 88) first, once the other projects have moved to Arthur, since only then is there more than one project to split; then signal (73), the cheapest, one local process; then Slack (91, 92), an official bot with no ban risk, a gateway client that has to stay alive; then WhatsApp (74), last of the channels; then the server (75 to 77), and the owner's own apps (95, AR0134), which reach it by the VPS's Tailscale name and took the next free number. The `place` the project agents route by is added to telegram's entries (47 to 50) and the channel contract (49) before the freeze (51), so it is frozen as a channel uses it. Discord moved up on the owner's pick (AR0134, 2026-10-18): its channels give each project its own chat in the first version, as Telegram's topics do; Slack stays later.

The decision log (96, AR0174) sits in orchestration right after autopilot (29): it needs only the coordinator's context (25), job state (27), planning (28) and the notices' redaction (AR0164), all merged, and every answer it keeps before the evals (67) and the decision models (AR0129) is data they start from; it took the next free number. Decision classes (97, AR0176) follow the evals (67), whose agreement rate is a class's evidence, so they close the develop entries.

Uptime (98, AR0227) was built early, on the owner's word of 2026-10-20 after a client's site went down unnoticed: the first stimulus source of the plan of AR0216, on its own and with no reaction chain, which that plan hangs on its events later. It needs only the event stream (5), the clock (7) and the project list (41), all merged, and took the next free number.

Video (102, AR0551) follows voice (81): it needs only the parts of 49, `arthur doctor` (80) and voice's `voice.transcribe` (AR0550) for the words of a video's sound track. It took 102, since the approved plan of AR0527 holds 99 to 101 for the activity log.

The host API, as these entries build it (entry 51 fixed it in `docs/plugin-api.md`, which wins over this summary): a plugin is a function from its options to `{ name, requires, setup(host), start?(), stop?() }`. `setup` registers; `start` runs long-lived work and is called only by `arthur run`. A `jobs.spawn` before every plugin's `setup` has run throws `<plugin>: spawn during setup; start jobs from start() or later`, so no job starts before the core follows the jobs. The host gives a plugin its options with every `...Env` name resolved, its own folder `.arthur/<plugin>/`, `events` (`on`, `emit`), `commands` (`register`), `jobs` (`registerKind`, `spawn`, `beforeSpawn`, `prepare`, `registerExtension`, `cleanup`, `block`, `registerMachine`, `run`, `list`, `running`, `result`: a job's final message), `board` (its `projects()` is the project list), `clock`, `code` (the package folders of the code the load runs: the core's and each enabled plugin's), and `provide(name, fn)` / `call(name, ...)` / `collect(name)`, through which plugins reach each other without importing each other.

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

- Package: core; `docs/setup.md` and `docs/deploy.md`.
- Delivers: `arthur run` loads the config, sets up every plugin, calls `start` in dependency order, and on SIGTERM calls `stop` in reverse; one process per home folder (a pid lock taken over from a dead pid). From the lock until the stops, it follows `.arthur/events.jsonl` from the last number it delivered, every 500 ms, and delivers to its subscribers the events another process (a command such as `arthur ticket` or `arthur spawn`) appended; a process that emits still delivers its own at once, and the daemon never delivers its own twice. No socket or port carries events. `docs/setup.md`: install Node, git, tmux and OMP on a VPS, the systemd user service that keeps `arthur run` alive (started again after it dies, the user manager too), `.env`; `docs/deploy.md`: the threat model, daily use, updating.
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

- Package: core; the phone commands moved to orchestration (entry 23) with AR0080.
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
- Delivers: in every job, a file tool or bash command that writes into the main checkout, the home folder `.arthur/`, or another job's worktree is refused: redirects, writing commands, `git` writes, `cd` there, symlinks, `git stash`. Reading passes. The shell parser is its own file, shared with the env guard. Since AR0376 the job's agent also runs in an OS sandbox (Landlock and seccomp, `packages/core/src/job-sandbox.ts`): it writes only to its worktree, its record, the Git folders its branch needs and `$TMPDIR`, has no Unix sockets, and a job where the sandbox cannot be set up logs `no sandbox: <why>`; the guard stays the mistake guard, the sandbox is the bound.
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
- Delivers: the plugin, required; its options (`maxAgents`, `coordinator`, `roles`, `plan`, `autopilot`, `morningReport`) checked; one interactive `omp` in its own tmux session (`coordinator.tmux`), with `--continue` and the coordinator's model and thinking, started with `-e` on `@arthur/core/env-guard` like every job; started again `restartDelaySeconds` after it ends for any reason; a start waits up to `exitWaitSeconds` for the previous `omp` to exit, so two never refresh the agent's credential at once; `arthur attach`; `arthur coordinator stop`, refused while any job runs; the coordinator's role file, in English. Since AR0080 also the board's phone commands of entry 18, `/board`, `/task` and `/findings`, read through `host.board` and the core's `host.jobs.list()` (every job record; `host.jobs.running()` is its filter of the jobs in a run).
- Coordinator rule (AR0083): ids in a destructive command (`prune`, `stop`, `steer`, `continue`, `ticket status`) are written out literally, never taken from a variable set in an earlier tool call.
- Done means: tested with the fake agent and a tmux socket in the test's folder. Edge cases: the previous `omp` still alive after the wait (the start is refused and logged, then retried); the coordinator crashing in a loop does not spin faster than the delay; `attach` with no session says so; a coordinator tool call naming a secrets file (`.env`) is refused with the env guard's line. The coordinator's role file carries the rule (AR0090, the harness's K0264) that a reply is written for an owner who remembers nothing of earlier turns, tickets, or files: every ticket, finding, job, or project a reply names gets at least one plain sentence on what it is and what the owner will see change (never file names); an id never stands alone. Every question to the owner says what is being decided, why it came up, the options with what each means in practice, and the coordinator's recommendation, so the message alone answers it. This outranks any limit on a reply's length: a reply that needs it runs longer, short per item.
- Depends on: 8, 10, 15.
- Size: a day.
- Covers: S1, O1, the coordinator's settings and the session options it owns.

### 24. The coordinator's inbox and the wake on job end

- Package: orchestration; an OMP extension in the coordinator's session.
- Delivers: messages for the coordinator (`message-received` `{ channel, text }` from a channel, `coordinator-message` `{ text }` from a plugin such as schedule, a job's end) are queued as files named by their event's number, so an event delivered twice is queued once, and delivered as one turn, in order, once the session is idle and the queue has not grown for 1 s; a human's message from a channel that arrives mid-turn joins the running turn after the next tool call as an aside that does not cut the tool batch (`[via <channel>, sent during this turn]`), or, after the last tool call, resumes the turn through omp's `session_stop` with the instruction that its reply above was not sent and the next one answers everything (`…, after your last tool call`), so the one reply that ends the turn answers it together with what the turn was already answering; a job's end or a schedule action never joins a turn; each finished turn's last reply is emitted as `coordinator-replied` `{ text, answers, channels }`, and only then are its messages answered; a turn ending in an error or aborted answers nothing and its messages go again, marked; one wake message for the jobs that ended while the coordinator was busy (state and reason, the first 15 lines of the result from `host.jobs.result(id)`, the lines plugins add through `collect("coordinator.wake", job)`, the project when it is not the main one), marked `[Arthur]` with one line saying it is not the owner's; a coordinator restart delivers again, marked, every message it was handed and no written reply answers; a footer while jobs run.
- Done means: tested with the fake agent's interactive session: idle delivery and the next turn; two messages in one tool call reach the turn in one aside, in order; a message after the reply was written resumes the turn and only the second reply is emitted; a message past omp's 8 continuations is the next turn; several messages within a second while idle are one turn; job ends and a schedule message mid-turn wait and make one message with one instruction line; a failed delivery is retried and the third failure is told once; an error turn's message goes again, marked; a restart mid-turn delivers the message once more, marked, and answers it once; a message a written reply answers is not delivered again after a restart; a repeated event queues once; a malformed message queues nothing and is logged; the footer set and cleared; the coordinator role carries the rule that a reply answers every human message since the last reply, a changing or cancelling one first, and names a question it still leaves open.
- Depends on: 23.
- Size: a day.
- Covers: O3.

### 25. The coordinator's context on every turn

- Package: orchestration.
- Delivers: on every turn the coordinator reads its role, each project's vision, the styleguide, a warning per missing criteria file, the board digest, the local time and whether it is night (from `host.clock`), and the lines other plugins add through `collect("coordinator.context")` (session: restart due; manage: retro due; projects: its block of project lines, 41); and the `prompts` key of a project in `projects` (the paths of its vision, criteria and role overrides), which 41 left out because the prompt loader reads fixed folders until this entry.
- Also delivers (F1 of AR0094): the coordinator's role is read like every other role, with the project's override and the criteria files, and `arthur roles` lists the coordinator and the file it reads.
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
- Done means: refused: a worker spawn on a plan ticket without an approved plan; filing a failed plan job. Edge cases: re-planning keeps one `plan.md`; plan review numbers continue; `/plan` of a ticket without a plan. Every plan and plan-review task carries `Ticket: spec/features/<id>-<slug>/ticket.md`, so placement (31) reads the ticket's labels; a test shows such a job lands on the ticket's machine (F1 of AR0125).
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

### 96. Decision log: what the owner decided when Arthur asked

- Package: orchestration; the coordinator's role (23) and the procedures of 27 and 28 name the command, and delivery's procedure at the review limit (52) names it when delivery is built.
- Delivers: every decision Arthur asks the owner for, and his answer, kept in one append-only file per project, `spec/decisions.jsonl`, next to the board and in Git: the coordinator commits it with the board. Only `arthur decision` writes it, never a hand: under a lock (`@arthur/core/lock`), the whole file written to a temporary name and renamed. What is asked, by kind: `job`, a job blocked on the user (27), recorded by the plugin itself when the job turns `blocked: user`, its notice naming the id (`<job> asks [AR-D12]: <question>`); `question`, a question in the coordinator's reply; `plan`, a planning ticket's plan waiting for approval (28); `review`, a FAIL after the second round (52); `budget`, a raise of a package's line budget. `arthur decision ask --kind <kind> --question <text> [--ticket <id>] [--job <id>] [--option <text>]... [--recommend <n or text>]` records the question, the options offered and the coordinator's recommendation, with the time in `timeZone`, the project and the ticket, and prints its id: the project's prefix, `-D` and the next number (`AR-D12`). How an answer finds its question: the coordinator names that id in the message that asks the owner, and records the answer on the turn it comes with `arthur decision answer <id> --decided <one line> [--picked <n>] <the owner's words>`: his words as he wrote or said them (a voice note's transcript), in his language; `--picked` the option he chose; `--decided` the decision in one English line. An answer that names no id is matched by the coordinator to the open question it answers, and its reply names the id it recorded, so the owner sees the match and corrects it with a new answer. A question with no answer stays open and never expires: every turn's context lists the open ones (id, age, question), so the coordinator asks again or closes it; a `close` line with its reason ends it when what it waits on is gone (its job ended or was continued, its ticket merged or dropped), or `arthur decision close <id> <reason>` does; an answer that comes after the close is still recorded, the owner's word outranking the close. An open or closed question is never a decision: none of the uses below reads it. Each line of the file is one record, `ask`, `answer` or `close`, with its id; a second answer to an id is a new line, and the later counts. Before a record is written, every text it holds, the answer first, is redacted with the notices' rules (orchestration's `credential.ts`, AR0164); its id, ticket and job are kept. A ticket's dated Decisions line is written from the answer's record, by the same command, after the log: `- YYYY-MM-DD: <decided>; the owner: "<his words>" (AR-D12)`, so a plan approval keeps the form the worker check reads (`Plan approved by the owner: plan.md at <commit>`, 28), and the coordinator's rule that every decision of the owner goes into the ticket's Decisions (23) becomes this command. Uses: the coordinator's context (25) gets, for each open question, up to 5 answered decisions like it, the same kind first, then the most words shared with the question, the newest on a tie, one line each with the question, the answer and the date; `arthur decisions [<words>] [--open] [--kind <kind>] [--ticket <id>]` lists and searches the log, one line per question, and `arthur decisions <id>` prints one whole; the eval runner (67) and the decision models (AR0129) read the file as it is, each answered decision an eval case (the question in, the coordinator's recommendation scored against the owner's pick or words) and a training example, with no reader for them in this entry. Entry 97, not this one, proposes a class of decisions the owner always answers the same way as pre-approved, as autopilot (29) pre-approves a ticket, and never without the owner's approval.
- Done means: refused, each naming why: `arthur decision` inside a job (`ARTHUR_JOB` set: a job never records the owner's word); an ask with an empty question, a kind outside the five, a `--ticket` not on the project's board, a `--recommend` number with no such option; an answer to an id the log does not hold, an empty answer, no `--decided`, a `--picked` with no such option; any write to a log with a line that is not a record (a hand edit), naming the line and leaving the file as it is. Edge cases: two asks at once (two ids, both lines kept); a second answer to one id (both kept, the later counts, the ticket gets a second line); a crash after the log's line and before the ticket's (the next `arthur decision` writes the missing line, found by its id); a Decisions line a human edited (named by `arthur decisions`, never rewritten); a ticket without `## Decisions` (the heading added); a question with no ticket (the log only); a key in the owner's answer (redacted in the file and in the ticket's line; a test with a key from the environment, as AR0164's); a job id or commit hash in an answer (redacted, as in a notice); a long answer (the ticket's line cut, naming `arthur decisions <id>`); a job blocked twice (two questions); a job continued before the answer (closed, `job continued`); a ticket merged with its question open (closed); an answer after the close (recorded); a project with no log (`arthur decisions` says `no decisions yet`, and reading creates no file); `--project` acts on another project's log; no open question means no similar decisions in the context; a fresh conversation (36) sees the open questions in its first context.
- Depends on: 25, 27, 28, 29.
- Size: a day and a half.
- Covers: none (new: the owner asked for it on 2026-10-19, AR0174).

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
- Delivers: a job's required labels: `arthur spawn --requires os=macos,tools=xcodebuild`, else its ticket's `requires`, else its project's, else none; `provide("jobs.place")`: among the online machines that have every required label (`tools` needs each tool listed) and are under their `maxJobs`, the one with the most room (from `call("resources.free")` when the resources plugin provides it, else the fewest jobs), `local` on a tie; `--machine` is checked against the labels too. Every job of a ticket (worker, review, plan) is placed by the same labels, so its checks run where it was built.
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
- Done means: refused: every spawn when free resources are too low to start anything, naming each machine and its shortfall (a normal `beforeSpawn` refusal, retried when a job ends as at `maxAgents`). Edge cases: room for more jobs than `maxAgents` (`maxAgents` refuses); a reservation exactly equal to what is free above `keepFree` starts; two spawns at once never both take the last room (jobs started since the last check count with their reservation); a machine whose check fails counts as no room, said once. `resources.free(machine)` answers a number, the jobs that machine has room for, as placement (31) reads it (`packages/machines/docs/commands/machines.md`); a test spawns through the machines plugin's placement on the fake host to prove the two agree (F2 of AR0125).
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
- Delivers: through `collect("doctor")` each enabled plugin provides its requirements, each `{ name, check(): ok | missing reason, costs: what does not work without it, fix: one command or step, critical?: boolean }`. The requirements: core: `git`, Node 24 or newer, the agent binary `omp`, `home` writable, each critical, and the CPU and memory controllers delegated to the user manager (13), not critical; orchestration: `tmux`, critical, since there is no coordinator without it; session: the systemd user service installed, enabled, with `Restart=always`, and linger on; telegram: the token present and the bot reachable; media (telegram's media in, 49): `ffmpeg`, for the videos the human sends; voice (81): the whisper.cpp binary `whisper-cli`, the model file, and `ffmpeg`; docker: Docker reachable on each machine labelled `tools: docker`; machines: SSH to each machine, and on it each tool its labels name; projects (41): an `about` for each project, not critical; nvm (84): nvm present on each machine; resources: the disk floor (69); models (82): each provider reachable and each listed model present. `arthur doctor` prints one line per requirement, `<plugin> <name>: ok` or `<plugin> <name>: missing: <reason>; without it: <costs>; fix: <fix>`, and exits 1 when anything critical is missing; it runs no model. At every `arthur run` start, doctor runs before the LLM probe (38), and its missing lines go first in the start notice. A critical miss refuses the start before any plugin's `start`, with those lines: printed, so the service's journal shows them, and sent as one `notice`; anything else starts, with reduced function. `arthur setup` (94) prints the same lines, from the same function.
- Done means: each line format above, `ok` and `missing`; exit 0 with only non-critical misses, 1 with one critical miss; no model and no network call beyond what a check names. Edge cases: a check that throws costs its line only, named (`<plugin> <name>: missing: check failed: <error>`), and every other line is still printed; a check that hangs is cut after 10 s (`missing: check timed out after 10 s`); a plugin disabled in the config is not checked and has no line; no systemd user manager (macOS, a container) is one non-critical line; the same missing line is not sent again at each start within a day unless it changed, so the service starting a refused `arthur run` again every 5 s sends its refusal once; a line fixed and missing again is sent again; with `home` not writable the refusal is printed only, since nothing can record that it was sent; `arthur doctor` always prints every line, sent before or not; no missing line leaves the start notice of 38 as it was.
- Depends on: 38, 4.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-16); the step after install of S8.

## Models

### 82. Models: providers on other machines, and a fallback chain

- Package: models, a plugin and not the core: its providers, keys and network probes are optional, as voice's binaries are, and the core never imports a plugin. In the core: a spawn's `model` may be an ordered list; the answer of `roles.model` may be a promise, awaited at spawn; `host.jobs.prepare` (9) may return variables for the job's environment, and `host.jobs.run(machine, argv)` runs one command on a machine (both changes entry 70 names; whichever entry is built first adds them). In orchestration: a role's `model` in `roles` (26) is one name or an ordered list.
- Delivers: the plugin and its options, checked: `providers`, named, each `{ kind: "ollama" | "openai-compatible", url, keyEnv? }`, and `probeSeconds` (default 3). A url's host must be loopback (`localhost`, 127.0.0.0/8, `::1`), private (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7) or Tailscale (100.64.0.0/10, fd7a:115c:a1e0::/48, a `*.ts.net` name); any other is refused at load, and a name is resolved at load and at each probe and refused when it resolves to any other address. A model is `<provider>/<model>`: one whose provider is in `providers` is a provider model, any other (`anthropic/claude-haiku-5-5`) a built-in one. Through `provide("models.pick")`, given an ordered list, it answers the first available model and the line why: a provider model is available when its server answers its model list within `probeSeconds` and lists the model (ollama: `GET <url>/api/tags`, where a name without a tag matches its `:latest`; openai-compatible: `GET <url>/models`, with `Authorization: Bearer <key>` when `keyEnv` is set); a built-in model is always available. One probe per provider runs at a time, and its answer is reused for 30 s. `provide("roles.model")` (AR0013, given by orchestration) returns the first available of the role's list through `call("models.pick")`; the core does the same with a list given on a spawn (a kind's option such as manage's `audit.model`, or `--model a,b`). The job's record names the model used and why (`mac/qwen3-coder unreachable: <reason>; using anthropic/claude-haiku-5-5`). Through `prepare`, a job on a provider model gets the provider in its own environment only, through what omp reads: ollama as omp's `ollama` provider (`OLLAMA_BASE_URL=<url>`, `OLLAMA_API_KEY` from `keyEnv`, `--model ollama/<model>`), openai-compatible as its `lm-studio` provider, which reads any OpenAI-compatible `/models` (`LM_STUDIO_BASE_URL=<url>`, `LM_STUDIO_API_KEY`, `--model lm-studio/<model>`). Not a `models.yml`: omp reads that only from its own agent folder (`~/.omp/agent/models.yml`, the owner's global file), and moving that folder (`PI_CODING_AGENT_DIR`) moves omp's settings and state with it. A provider model costs 0: its job keeps its time limit, its budget is 0 (no limit, 12), and the record says `budget: none, free model <name>`. Through `collect("doctor")` (80): each provider reachable, each listed model present, each critical only when a list names it with no later model on another provider or built in; omp's own `models.yml` configures neither `ollama` nor `lm-studio` (its provider would replace the one the job's environment sets), critical when a provider of that kind is listed.
- Done means: tested against the fake agent and a fake Ollama and a fake OpenAI-compatible server on a loopback port, each answering its model list in its documented shape, every field included (Ollama: `{ models: [{ name, model, modified_at, size, digest, details }] }`; OpenAI: `{ object: "list", data: [{ id, object: "model", created, owned_by }] }`). Refused at load: a `kind` other than the two; a url that is not `http` or `https`, or whose host is public; `probeSeconds` not a positive whole number. Refused at spawn, before any record exists: every model in the list unavailable, naming each with its reason (`no model available: mac/qwen3-coder: unreachable: timed out after 3 s; lab/qwen3: not in its model list`); a list while the models plugin is off (`a model list needs the models plugin`). Edge cases: a slow probe is cut at `probeSeconds` and the next model is tried; a provider whose list lacks the model; a server answering HTTP 401, or something that is not a model list; a key read from the env file reaches only the probe's header and the job's environment, never the record, the log or a refusal; two spawns at once make one request to the server (counted by the fake), and a spawn 30 s later makes a new one; a single provider model given with `--model` is probed too and refused, with no fallback, when unavailable; a job on another machine (21) is probed from that machine (through `host.jobs.run`), since a loopback or private url may not reach the same server from there; a model lost mid-job (the Mac goes to sleep): the job fails with the reason the agent gave and is never switched to another model mid-run; `arthur roles` shows each role's list as written and probes nothing.
- Also delivers (the owner, 2026-10-16: see each provider's limits simply and for any provider): `arthur usage` and `/usage` print each authenticated account's limit windows (used %, resets in) from the agent's own report (`omp usage --json`), never an email unless asked; the fallback chain skips a model whose provider window is at or over `limits.stopAt` (default 95%); a job's spawn line and the coordinator's context carry the windows over `limits.warnAt` (default 80%). Edge cases: an agent without a usage report (`arthur usage` says so, nothing skipped); a provider that does not report (its line says `no data`); a report older than 10 minutes is fetched again, a failed fetch keeps the last one with its age.
- Depends on: 26, 12, 21, 80.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-16: a model on his Mac over the network, and when it is not available another available model of similar strength).

## Schedule

### 39. Schedule entries and the sweep

- Package: schedule.
- Delivers: entries from the config and from the `file` option: a daily `HH:MM` (optionally on some days) or a one-off date and time, in `timeZone`; an action (a message to the coordinator `[scheduled <id>] …`, emitted as `coordinator-message` `{ text }` (24), optionally naming a procedure) or a job (spawn of a kind); each due slot claimed once, run state in `.arthur/schedule/`.
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
- Delivers: the `list` option, in `arthur.config.ts` and nowhere else (no file per repository, so none can win over another), each project with `name` (lowercase letters, digits, dots and dashes), `prefix` (capital letters) and exactly one of `path` or `repo` (a Git URL cloned into `reposDir`, which lies outside the home folder: at load when missing, into a temporary name then renamed), all required; optional `title` (the full name, e.g. `Shop` for `SH`; one line of at most 60 characters, the name by default), `about` (what the project is and what it is for; one line of at most 300 characters) and `install`; read by later plugins and checked here for their shape only: `tracker`, `ci`, `commitRules`, `autoMerge`, `requires` (the machine labels its jobs need, read by placement, 31) and `docker`. No aliases and no `branch`: one repository may be several projects, each checkout its own entry with its own name, prefix and folder, which is how a client branch is declared. `provide("projects")`, which the host serves as `host.board.projects()`; the core's job runner starts a job of `--project <name>` from that project's folder, the first in the list being the main one, and refuses an unknown name, naming the projects. `arthur projects` and the phone command `/projects`: each project's line (below), its folder, its open tickets and the install that applies. A `prepare` hook for every kind that installs a new worktree's dependencies on the job's machine with the project's `install` command (a shell command, such as `composer install` or `uv sync --frozen`); without `install`, the lockfile at the job's commit picks a frozen install for the managers the plugin knows (`bun.lock`: `bun install --frozen-lockfile`, `package-lock.json`: `npm ci`, `pnpm-lock.yaml`: `pnpm install --frozen-lockfile`, `composer.lock`: `composer install`, `uv.lock`: `uv sync --frozen`), and a project with none of them and no `install` gets nothing; `install: ""` turns it off; no copy of the main checkout's `node_modules` (measured 2026-10-15 on the VPS: `bun install` 2.4 to 2.8 s against a 17 to 32 s copy, and a copy carries a stale install over, harness K0246). Until it exists, a job installs from the lockfile itself, as the worker's role tells it.
- Done means: refused at load, naming the project: a missing `name` or `prefix`; both or neither of `path` and `repo`; any other key, `pathPrepend` and `prompts` included; a wrong shape for any key; two projects with one name, prefix or title, compared without case and across the three keys; two projects with one folder; a `path` that is not a folder with `.git`; a `repo` without `reposDir`, or `reposDir` inside the home folder. Edge cases: a repo already cloned with another remote is refused, not overwritten; a clone that fails names the project and leaves no folder; `/projects` with a broken board gets `board unreadable: <error>` for that project only; no `install` and no known lockfile (nothing installed); two known lockfiles and no `install` (refused at load and at the spawn, naming the project and the files); an install that fails stops the spawn, naming the project and the command; a read-only kind installs too.
- Also delivers (the owner, 2026-10-16: the coordinator must know what a prefix means, with a simple config): the coordinator's context on every turn (25), through `collect("coordinator.context")`, carries one block: a line saying how a word names a project (a prefix, name or title, in any case, names it, even when another project's title or about holds the word; a word found in only one project's title or about names it; a word that fits none or several: ask which, naming the candidates), then one line per project in config order, `SH Shop (web-shop): <about>`, `(name)` left out when it equals the title and `: <about>` when there is none, at most about 410 characters a line; `/projects` shows the same lines. A missing `about` is one non-critical requirement of `arthur doctor` (80) through `collect("doctor")`: `projects <name> about: missing: no about`, the coordinator knowing the project only by prefix, name and title. Adding a project is a few lines in the config, checked with `arthur projects`; there is no `arthur project add`, which would rewrite TypeScript the human owns. Edge cases: an `about` longer than 300 characters or a `title` longer than 60 (refused at load, naming the project).
- Depends on: 6, 17.
- Size: a day.
- Covers: P2, P4, T8, B3 (where the prefix is set), G8 (the paths), G13.

### 93. Option tables: every option with its meaning, and the tools each plugin runs

- Package: core (the table's type and its walker, published in `@arthur/core`'s exports; the core's own table) and the two plugins built before it, orchestration and projects (their tables); each later plugin writes its table in its own entry.
- Delivers: every option the core and each plugin accept is an entry of one table: `{ about, check }` for a value, or `{ about, fields }` for a nested object, where `about` is the option's meaning in one line. The plugin's own option check walks that same table, so an option without its meaning cannot exist and the list never drifts from the code. It is the third table of one shape, so the core publishes the type: the core's `SHAPE` in `config.ts`, orchestration's `FIELDS` in `orchestration-options.ts` and projects' `FIELDS` in `project-options.ts` become tables of it. Each package's options file also exports a one-line `summary` of the plugin and `tools`, each `{ name, version: argv }`, the command that prints the tool's version: the core names `git`, `node`, `omp`, `ssh` and `systemd-run`; orchestration names `tmux`. Each plugin package publishes this file as `@arthur/<plugin>/options`, which loads without setting up the plugin.
- Done means: every refusal the option checks gave before is given the same, its option path and wording included, so their tests pass unchanged; a nested object's fields are walked at any depth. Refused by a test over every package's table: an entry without `about`, with an empty one, or with a line break in it; a `summary` that is empty or more than one line; a tool without a `version` command. Edge cases: an unknown key is still refused, naming its path; an option two levels deep (`coordinator.tmux.session`) has its meaning like a top-level one.
- Depends on: 23, 41.
- Size: half a day.
- Covers: S8.

### 94. `arthur setup`: what is there, what is set, what is missing

- Package: core; `docs/setup.md` points to it.
- Delivers: `arthur setup`, a report you run again after each fix. It writes nothing, installs nothing, never runs a model, and never prints a variable's value. It finds the installed plugins by listing `node_modules/@arthur/*` from the config's folder and loads each package's `./options` (93) by path, the way the core already loads `arthur.config.ts`: no static import, so the core still imports no plugin (the structure test of entry 1 stays as it is; the reviewer judges this reading by path), and a plugin that is installed but not in the config is shown too. Plugins that are planned but not built have no code to read, so they are not listed; the roadmap names them. Its sections, in this order:
  1. Tools: each tool in the `tools` of the core and every installed plugin, its version (the first line its `version` command prints) or `not found`, and which plugins use it, marked `(off)` or `(not in the config)`. The core's tools include `tailscale`, which the Tailscale step of `docs/setup.md` needs on every machine; no plugin uses it yet, so it is shown as `core`.
  2. Config: the core, then each plugin the config lists, `on` or `off`. For each one that is on: its options `set` and `not set`, and its env lines as `arthur config check` prints them, `set` or `missing`, never a value.
  3. Requirements: `arthur doctor`'s lines (80), from the same function.
  4. Can still go in arthur.config.ts: each installed plugin that is off or not listed, with its `summary` and every option's meaning, and its default when it has one.
  5. Next: numbered steps, each with its fix, in this order: config, then env, then critical requirements, then the rest; and the closing line `Run arthur setup again after each step.`

  An example run, at a point after telegram (47) and voice (81) exist; their option names are the example config's proposals:

  ```
  $ arthur setup
  Tools
    git          2.43.0          core
    node         v24.21.0        core
    omp          omp/18.3.0      core
    ssh          OpenSSH_9.6p1   core
    tailscale    1.78.1          core
    tmux         3.4             orchestration
    ffmpeg       not found       telegram, voice (off)
    whisper-cli  not found       voice (off)
    docker       27.3.1          docker (not in the config)

  Config: arthur.config.ts
    core           set: home, jobs.budgetUsd; not set: envFile, agent, timeZone, quietHours, jobs.timeoutMinutes, …
    orchestration  on   set: maxAgents, coordinator.model; not set: coordinator.tmux, roles, plan, autopilot, morningReport, …
    projects       on   set: list (2 projects), reposDir
    telegram       on   set: bots (1), media
                        env set     ARTHUR_TELEGRAM_BOT_TOKEN (telegram.bots[0].botTokenEnv)
                        env missing ARTHUR_TELEGRAM_CHAT_ID (telegram.bots[0].chatIdEnv)
    voice          off (enabled: false)

  Requirements (arthur doctor)
    core git: ok
    core omp: ok
    orchestration tmux: ok
    telegram ffmpeg: missing: not found; without it: the videos you send reach the coordinator as files; fix: sudo apt-get install -y ffmpeg
    projects shop board: missing: no spec/build.json; without it: no tickets for shop; fix: arthur init shop

  Can still go in arthur.config.ts
    voice (off): local transcription of voice notes with whisper.cpp
      model           a whisper.cpp model name, or a path to a .bin file; default "small"
      threads         CPU threads whisper uses; default 4
      language        a language code, or "auto"; default "pl"
      timeoutSeconds  a longer transcription is cut; default 300
      maxSeconds      a longer note is not transcribed; default 600
    docker (not in the config): labels and removes the Docker resources of each job
      buildCache      the cap of Docker's build cache
      leftoverHours   unlabelled leftovers older than this are swept
      sweep.at        the daily sweep, "HH:MM"

  Next
    1. Set ARTHUR_TELEGRAM_CHAT_ID in .env (telegram.bots[0].chatIdEnv), then arthur config check. Refuses the start.
    2. sudo apt-get install -y ffmpeg
    3. arthur init shop
  Run arthur setup again after each step.
  ```

- Done means: exit code 1 when a step in Next would refuse `arthur run` (a config or env refusal, a critical requirement), else 0; a test sets a known value for a variable in the shell and another in `.env` and finds neither in the output. Edge cases: no config (Config says `no arthur.config.ts`, and Next's first step is writing it, pointing to `docs/setup.md`); a config that does not load (its refusal under Config, Requirements skipped, exit 1); a tool whose version command fails or hangs (`not found` or `no version: <its last line>`, cut after 5 s; every other line still printed); an installed package without `./options` (named, `no options table`, every other plugin still listed); a plugin listed with `enabled: false` (off, its env not read, listed under Can still go); nothing missing (Next says `nothing`, exit 0).
- Depends on: 93, 80.
- Size: a day.
- Covers: S8.

### 42. Onboarding a repository

- Package: projects.
- Delivers: `arthur init <project>` gives a project's repository what Arthur reads (the `spec/` skeleton, the criteria files, an empty board) and an `.nvmrc` with the major version of the Node it runs on (`24` today), unless the repository has one, for the nvm plugin (84); the kind `onboarding`: reads the repository, asks up to 10 questions, then drafts the vision and criteria; the procedure sent when it ends; its merge accepts only those files (`init` writes the `.nvmrc`, not the job). Its `doctor` requirement (80), one per project, not critical: `projects <project> board: missing: no spec/build.json; without it: no tickets for <project>; fix: arthur init <project>`, so `arthur setup` (94) walks a new owner to `arthur init`.
- Done means: refused: `init` on a project not in the config, `init` over an existing board. Edge cases: an empty repository; an existing `.nvmrc` is kept unchanged; a repository without `package.json` still gets one; the onboarding asking more than 10 questions is cut at 10; a draft touching another file is refused at merge.
- Depends on: 41, 10.
- Size: a day.
- Covers: P1, P3, O8.

### 84. nvm: each project's Node version

- Package: nvm; in the core, `host.jobs.prepare` (9) may return variables for the job's environment, and the variables a `prepare` returns reach the prepares after it (the change entries 70 and 82 name; whichever entry is built first adds it).
- Delivers: through `prepare`, for a job whose worktree has `.nvmrc`, it runs `. "$NVM_DIR/nvm.sh" && nvm which <version>` on the job's machine through `host.jobs.run`, and that bin folder goes first on the job's `PATH` through the variables `prepare` returns; nvm's prepare runs before the install of 41, so the install runs under the same Node. Its `doctor` requirement: nvm present on each machine. Bun has no nvm: it stays on the service `PATH` (`docs/setup.md`, step 8).
- Done means: tested against the fake host and a fake `$NVM_DIR/nvm.sh`. Edge cases: no `.nvmrc` (no variable, the machine's default Node is used); a version that is not installed refuses the spawn, naming the version, the machine and the fix `nvm install <version>` (no download during a spawn); an empty or unreadable `.nvmrc` is refused, naming the file; nvm missing on the machine is refused, naming the machine; a job on another machine resolves the version there.
- Depends on: 41, 21, 80.
- Size: half a day.
- Covers: the `PATH` setting.

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
- Done means: refused at load, naming the project: a project's `tracker.instance` this plugin does not have (41 checks only its shape). Refused before any call: an issue id outside the project's YouTrack project. Edge cases: the token never appears in an error (asserted with a known token); a 401, a 404, a timeout each give one line; paging past the first page; an unnamed and a named instance side by side.
- Depends on: 41.
- Size: a day.
- Covers: Y1 (reading), P4.

### 45. YouTrack: writing issues, articles, fields and work items

- Package: youtrack.
- Delivers: create or update an issue or an article from a file, set a custom field, add a work item; delete an issue or an article (AR0220, the owner on 2026-10-20), for the coordinator, never for a job. The rest of full management (AR0222, the owner on 2026-10-20): `issue list --query` and `article list --query` in YouTrack's query language, kept inside the project; issue links (`links`, `link`, `unlink`, types as the instance names them), tags (`tag`, `untag`), `issue move` to another project of the instance, work items listed, edited and deleted; articles like issues: comments, attachments, a sub-article (`article create --parent`) and `article move --parent`. Project, board, sprint and user administration stay out.
- Done means: edge cases: a field value the project does not allow (YouTrack's error in one line); updating an article that changed meanwhile; an empty file; a work item of 0 minutes is refused. For each AR0222 verb: an id outside the project's YouTrack project (a link's other issue and a parent article too) refused before any call; a job refused for every write; YouTrack's error in one line; the token never in an error; a search that closes its parenthesis never lists another project's item.
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

- Package: telegram; in orchestration, the silent mode (AR0127): `arthur silent` and `/silent`, its state, the hold, the context line and the coordinator's rule.
- Delivers: `bots` (named instances); long polling (30 s); only the allowed chat; messages older than 10 minutes dropped; text becomes `message-received` `{ channel: "telegram", text }`, which the inbox marks `[via telegram]` (24); `coordinator-replied` (to the replies whose `channels` hold `telegram`, and to a reply with no `channels`, from a turn of only `[Arthur]` messages, as to a notice) and `notice` are sent, long text in slices at line breaks; during quiet hours sent without a notification; any other kind of message gets `only text, photos and files reach the coordinator`; tested against a fake Bot API in the shape of its documentation.
- Done means: edge cases: a second poller (409) is said once and polling retries; a message from another chat is ignored and not acknowledged into the coordinator; a slice boundary inside a long line; quiet hours across midnight.
- Also delivers (AR0098, for the project agents of 85 and 86): a message sent in a topic carries its `message_thread_id` as `place` in `message-received`, and a send with a `place` passes it as `message_thread_id`; a message outside any topic has no `place`, and a send without one goes to the chat itself. Telegram's docs say topics work in the owner's private chat with the bot ("private chats of bots with forum topic mode enabled", `getMe.has_topics_enabled`), so the allowed chat stays one chat, with no group and no privacy-mode problem.
- Also delivers (AR0127, the owner on 2026-10-18: work he delegates, heard of only at its end): a silent mode. `arthur silent` and the phone command `/silent` (orchestration; Telegram allows no hyphen, so one command toggles) answer with the new state: `silent: on`, or `silent: off, <what happened meanwhile>`, built without the model from the events since it went on: the jobs that ended, by state, the tickets merged, and the notices held (`silent: off, nothing happened meanwhile` when none). The coordinator turns it on by itself when the owner delegates work with a stop condition (a limit of time, money or tickets), with `arthur silent on '<the work; its stop condition>'`, and off with `arthur silent off` when that work ends. The state is `<home>/orchestration/silent.json` (since when, the event number it went on at, the work), written to a temporary name and renamed, so it survives a restart; no file means off. While on, the reply of a turn holding no owner message (a job's end, a review, a schedule entry) is held in `outbox/held/`, not emitted, unless that turn ran `arthur silent off` (the work is done or its stop condition met) or `arthur silent ask` (the owner must decide; silent stays on), so the owner gets one message for each; the reply of a turn holding an owner message is sent as always, and answers that message only, not the wakes beside it; before it sends a notice, each channel asks `call("coordinator.silent", notice)`, which holds every notice but the one of a job blocked on the owner (27), a decision. The coordinator's context (25) gets a `## Silent` line (since when, the work, its stop condition), and its role says what counts as done (every ticket of the work merged or dropped, no job of it running), met (the stop condition reached) and a decision (what only the owner may do: approve, merge, answer a question no ticket answers).
- Done means (AR0127): edge cases: `/silent` twice (on, then off with the summary); `arthur silent on` while on keeps since when and replaces the work; `arthur silent off` while off answers `silent: off` and changes nothing; a restart while on (still on, the context says so, held replies stay held); a wake and an owner message in one turn (the reply is sent); a job blocked on the owner (its notice is sent); quiet hours (what silent lets through goes without a notification, as every send); a state file that does not parse counts as on, its context line names the file, and `arthur silent off` removes it.
- Depends on: 24, 25, 27, 7.
- Size: a day and a half.
- Covers: T1, T2 (sending); the silent mode: none (new: the owner asked for it on 2026-10-18, AR0127).

### 48. Telegram: the outbox and retries

- Package: telegram.
- Delivers: one retry per send; a failed slice queued in `.arthur/telegram/outbox/` and sent first next time, in order; a refused (4xx) slice set aside and told once; a text too long for one message cut with a note.
- Done means: edge cases: the outbox survives a restart; a 429 waits as Telegram says; a 4xx slice does not block the ones after it; two processes sending at once keep order.
- Also delivers (AR0098): a slice in the outbox keeps its `place` and is sent to it; edge case: a queued slice for a topic, sent after a restart, reaches that topic.
- Depends on: 47.
- Size: half a day.
- Covers: T2.

### 49. Telegram: media in and out, `arthur send`

- Package: telegram; in the core, the `parts` of `message-received` and how they become the coordinator's turn (the contract every channel uses, 73, 74 and 89 to 92 included), the `arthur send` command, and the `channel.send` name every channel provides.
- Delivers: a channel only receives: it saves what came and emits one `message-received` with `channel` (its plugin's name) and `parts`, in the order the message holds them, each `{ kind: text | photo | video | voice | audio | file, path?, text?, mime, seconds? }`. A text or a caption is a `text` part with `text` and `mime: "text/plain"`; every other part is a file the channel saved under `.arthur/<channel>/`, with its `path`, its `mime`, and `seconds` when the channel gives a length; an album is several parts of one message. On Telegram: a photo (largest size), a video or a round video note (`video`), a voice note (`voice`), an audio file (`audio`), any other document (`file`); any other kind of message (a sticker, a location, a poll) gets `only text, photos, videos, voice notes, audio and files reach the coordinator`. The channel transcribes, converts and reads nothing. Before the coordinator gets the turn, the core asks `collect("message.part", part)` of the enabled plugins for each part that is not text: a plugin that handles the part's kind answers `{ text, reply? }` (or a promise of it), any other `undefined`; the first claim in setup order replaces the part by its `text`, and its `reply` goes back to the human through the channel the message came from. An unclaimed media part reaches the coordinator as its saved path, as before; an unclaimed `voice` part (no voice plugin, 81, is enabled) becomes one line `[voice note not transcribed: the voice plugin is not enabled]`, and the channel says the same line to the human. The turn is `[via <channel>]` and each part's text, in order. Messages keep their order: one waits until every part of the ones before it is resolved, so a text sent after a voice note does not overtake it. `arthur send <file>… --caption` sends through every enabled channel: on Telegram photos and videos as an album, other files as documents after it, up to 10 files, sizes and extensions checked before anything is sent.
- Done means: refused before any send: 11 files, a file over Telegram's size limit, a photo whose sides break Telegram's limits (with a hint to slice it). Edge cases: the token never in an error; an album of one; an album of photos and a video with a caption (one message, its parts in order); a voice note with no plugin enabled (the line to the coordinator and to the human); a claim that throws or rejects leaves the part as its saved path, with the plugin and its error in one line; a text right after a voice note whose claim is slow reaches the coordinator after it; no channel enabled (`arthur send` says so).
- Also delivers (AR0098, before the freeze in 51, since it is the contract every channel uses): an optional `place` (a Telegram topic, a Discord or Slack channel id) on `message-received`, `channel.send`, `coordinator-replied` and `notice`: a channel sets it on a message that names one, and sends to it when one is given, else to its allowed chat.
- Depends on: 47, 6.
- Size: a day.
- Covers: T3, T4.

### 50. Telegram: phone commands and the menu

- Package: telegram.
- Delivers: `/name text` routed to the host's command registry and the reply sent; the bot's command menu built from the phone commands the plugins register; the session's start notice sent as it comes.
- Done means: edge cases: `/name@botname`; an unknown command gets the registry's line; the menu updated when the set of commands changed, not on every start; a command's reply longer than one message.
- Also delivers (AR0098): `route` passes the message's `channel` and `place` to a phone command, and its reply goes back to that place, so `/restart` knows which session to restart (36, 88).
- Depends on: 47, 6.
- Size: half a day.
- Covers: T5, G3 (routing).

### 51. Freeze the host API

- Package: core; `docs/plugin-api.md`.
- Delivers: the host API as schedule, youtrack and telegram use it, written down: the plugin shape, every host member, every core event and its fields, the `provide` names in use; the published types in `@arthur/core`'s exports, the option table's type included (93); each plugin package's `./options` export (93): its option table, `summary` and `tools`; whatever no plugin uses removed. From here a change to the API is a decision recorded in its ticket.
- Done means: the three plugins and the fake host use only what the doc lists (a test lists the core's exports and fails on one the doc does not name); `npm run check` passes with the types tightened. Also (AR0178, folded in on 2026-10-19 on the owner's word): the frozen option table decides whether an entry may name keys of its own beside `each`, and `roles.quick.model` gets its own line in orchestration's table, with a test, so its meaning is not only in the `about` of `roles`.
- Depends on: 40, 46, 50.
- Size: half a day.
- Covers: the vision's decision to derive the API from three plugins.

## Uptime

### 98. Uptime: each project's sites checked, a notice when one is down and when it is back

- Package: uptime; `packages/uptime/docs/uptime.md`.
- Delivers: the option `sites`, each project's list of `{ url, expect?, everySeconds? }` by the project's name (`expect` a status code or a text the page holds; `everySeconds` default 60), each in the plugin's option table (93). While `arthur run` runs, each site is checked with a plain HTTP `GET`, redirects followed and no model called, cut after 10 s or `everySeconds` when shorter. A site is down after 2 failed checks in a row (no answer in time, connection refused, a TLS error, a wrong status, the text missing): one `notice` with its URL, the reason and since when, and the event `uptime-down`; when it answers again, one notice with how long it was down, and `uptime-up`. With 2 or more sites not down, a site about to go down for want of an answer makes the plugin ask every other site at once; when none answers, this machine is taken as offline: one notice that the checks cannot run, none per site, and one when a site answers again. What is down, and since when no site answers, is kept in `.arthur/uptime/state.json` across a restart. The notices go out as every notice does, so the channels send them without a sound in quiet hours and the silent mode holds them.
- Done means: tested against the fake host and a local HTTP server on a port the OS picks. Refused at load: a key of `sites` that is not a project, a `url` that is not http or https, an `expect` or `everySeconds` out of range, the same `url` twice in one project. Edge cases: a slow answer past the timeout; a redirect (the page it leads to is judged); a 500 that answers at the second check (no notice); this machine offline (every site fails at once: one notice, not one per site); quiet hours; a restart while a site is down (no second down notice, its up notice counting from before the restart) or while offline; a state file broken or edited by hand.
- Depends on: 5, 7, 41.
- Size: half a day.
- Covers: none of the harness Arthur replaces: a new capability, the first stimulus of AR0216.

## Delivery

### 52. Review jobs

- Package: delivery.
- Delivers: the kind `review` (read-only, a fresh model, the reviewer role and review criteria); the verdict `PASS` or `FAIL` from the last line moves the ticket to done or in-progress; no verdict fails the job; `arthur ticket file` of a review writes the next `review-N.md`, never twice; at most 2 FAILs since the last PASS, then `--round N`; the procedure sent at the limit.
- Done means: edge cases: `PASS` not on the last line is no verdict; filing the same review twice is refused; the third review without `--round` is refused, naming the two FAILs. Every review task carries `Ticket: spec/features/<id>-<slug>/ticket.md`, so placement (31) reads the ticket's labels; a test shows a review of a ticket with `os=macos` lands on that machine (F1 of AR0125).
- Depends on: 51.
- Size: a day.
- Covers: D1, B7, O10.

### 53. `arthur review-needed`

- Package: delivery; in the core, `host.jobs.registerExtension(url)`: an OMP extension each job's agent loads with `-e`, after the core's own.
- Delivers: decides review or no review for a branch: the always-review list (`review.alwaysReview`), deleted files, `.env` text in the diff, docs-only changes, small branches with passing checks; records the verdict and moves the ticket; `provide("delivery.alwaysReview")`. The passing checks come from a job's `checks`, which delivery's own extension, registered through `host.jobs.registerExtension`, writes to `.arthur/delivery/<id>/checks` from each bash `tool_result` while the agent runs: one line per run of the project's own checks, for the `check` and `test` scripts of the worktree's `package.json`, `check pass|fail` for `npm run check` (a TypeScript error in its output fails it), `test pass|fail <passed>/<total>` for `npm test` from node --test's last summary (`test pass|fail` from the exit status without one), and `stale` after the first edit or write that follows them.
- Done means: a table of branches with the decision for each. Edge cases: a renamed file on the list; a branch with no commits; a docs-only branch that also deletes a file. For `checks`: commands joined by `;`, `&&` or `|` (a piped `npm test | tail` read from its output); a script the `package.json` does not declare, or a missing or broken `package.json` (no line); `npm t` and `npm run test`; a command that only mentions `npm test` (no line); two edits after a check (one `stale`). The default always-review list covers the files that read secrets (the `.env` loading of entry 3) and the CI-failure handling (57 to 59).
- Depends on: 52.
- Size: a day.
- Covers: D2.

### 54. `arthur merge`

- Package: delivery.
- Delivers: files the reviews, merges the branch into main, runs install and the project's checks, resets main when a check fails; open findings go to the `findings` plugin's `onMerge` (83), which by default makes each a planning ticket; writes `outcome.md`; sets merged; names the tickets the merge unblocks; `--unreviewed` on the owner's word; the procedure sent after a merge.
- Done means: refused: a branch without a PASS on its tip (unless `--unreviewed`), a dirty main. Edge cases: a merge conflict leaves main as it was; a failed check resets main and says which check; findings with no open entry make no ticket; a finding's ticket gets the next id. Also (AR0183, folded in on 2026-10-19 on the owner's word): before `git merge`, `collect("merge.check", job)`, and any text answer refuses the merge with every answer, main unchanged; tested with a fake plugin that provides `merge.check`, and with the projects plugin refusing an onboarding's branch that changes a file other than the vision and the criteria.
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
- Delivers: `instances` (`tokenEnv`); every `poll.everySeconds` the CI runs of the branches in play, for each project's `ci.workflow`; `ci-finished` once per run attempt (AR0238: a rerun keeps its run id); for a commit that touches no watched path, the run of the nearest commit before it; tested against a fake API in the shape of GitHub's REST documentation.
- Done means: edge cases: the same run seen on two polls emits once (across a restart too); a rate-limit answer waits as GitHub says; a 401 is said once, not every poll; a branch deleted while in play.
- Depends on: 41, 51.
- Size: a day.
- Covers: GH1 (runs), the GitHub setting.

### 58. GitHub: `arthur ci`, reruns, pushes, pull request reviews

- Package: github.
- Delivers: `arthur ci <branch>` tells why a run failed (the failed step, the end of its log); `--rerun` reruns a failed or cancelled run once; the reviewed branch and main pushed to origin (one warning line on failure, never a prompt); pull request reviews polled and emitted for the coordinator when `wakeOn` names them.
- Done means: refused: a second `--rerun` of the same run; a rerun of a passed run. Edge cases: a log too long (its end only); a push rejected as non-fast-forward; no remote. `arthur ci` reads the same run `arthur merge --auto` counts (59): the newest run that built the branch (57), not only a run on the tip commit.
- Depends on: 57, 52.
- Size: a day.
- Covers: GH1 (`arthur ci`), GH2.

### 59. Auto-merge after PASS and green CI

- Package: delivery.
- Delivers: `arthur merge --auto`: merges only with a PASS on the tip, CI passed (asked of github through `call`), the project's `autoMerge` on, and no held path (roles, vision, CI, `package.json`, the always-review list); `--no-ci` on the owner's word.
- Done means: refused, each naming the rule: a PASS on an older commit, CI pending or failed, a held path, `autoMerge: false`, github disabled without `--no-ci`. Edge cases: CI passed on the tip after a new commit; a held path renamed. When CI ends while the branch waits, the coordinator is woken with the verdict once per run end, also across a restart; a CI run that hangs is cancelled after 30 minutes.
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
- Delivers: `morningReport.at` registers a schedule action with its procedure: built overnight, merged without the owner, waiting for approval, waiting for a decision, needs attention (from health). Orchestration sets up `after: ["schedule"]` (AR0168: set up after schedule when it is loaded, no refusal when it is not), so its `setup` registers the action through `schedule.register` only when schedule provides it; schedule stays optional.
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

### 97. Decision classes: pre-approved from the decision log

- Package: orchestration; the coordinator's role (23) names the commands.
- Delivers: a class of decisions the owner always answers the same way, proposed from the decision log (96) and pre-approved only on his word, as autopilot (29) pre-approves a ticket. A class is a kind of the log and what its questions share (the words the question names, its ticket's kind), with the answered decisions that back it, each the owner's same answer, and the evals' (67) agreement rate between the coordinator's recommendation and the owner's pick on those decisions, the evidence for the class. `arthur decision class propose --kind <kind> --match <text> --decided <one line> --backed-by <id>...` records the proposal in the log as a question of its own and prints its id; the coordinator asks the owner with that id, the class, its backing decisions and their agreement rate, and the owner approves or refuses it through `arthur decision answer <id>`, as any other question. Only an approved class holds, from its answer on; a refused or unanswered one answers nothing. A later question that matches an approved class is answered by policy: `arthur decision ask` records the question and, in the same command, its answer, the class's decision, marked `by policy: <class id>` in place of the owner's words, in the log and in the ticket's Decisions (`- YYYY-MM-DD: <decided>; pre-approved by policy (<class id>)`), and the coordinator acts on it as on the owner's answer and says it in its reply, so the owner sees each one. The owner revokes a class with `arthur decision class revoke <id> <his words>`, a record in the log: from then its questions go to him again, and the answers given by policy before stay as recorded. `arthur decisions --classes` lists each class, proposed, approved, refused or revoked, with the questions it answered.
- Done means: refused, each naming why: `arthur decision class` inside a job; a proposal backed by no decision, by an id the log does not hold, by an unanswered one, or by one whose decision differs from the class's; a proposal for a class's own kind (a class never approves a class); an approval given by policy; a `revoke` of an id that is no class or an already revoked one. Edge cases: a class refused (its questions still go to the owner); a question that matches two approved classes goes to the owner, naming both; a question asked after the revoke goes to the owner; a second answer to the proposal (the later counts, as in 96); a policy answer's line in the ticket names the class, never the owner; the decision models (AR0129) are out.
- Depends on: 96, 67.
- Size: a day.
- Covers: none (new: the owner approved it on 2026-10-19, AR0176).

## Disk

### 69. Resources: free disk space per machine

- Package: resources.
- Delivers: `keepFree.disk` (bytes with K, M, G or T; `0` = no floor). At every machine check (34), the free space of each filesystem the machine's jobs write: its `home`, and each path another plugin names for that machine through `collect("resources.disk", machine)` (docker: its data root, 70); `df -Pk` on every machine, over SSH on another one, so `local` takes the same path. Through `beforeSpawn`, no job starts on a machine whose least free filesystem is under the floor; the refusal names the machine, the path, the space and the floor (`build: no room, 12.3 GB free on /var/lib/docker, floor 20 GB`), and `resources.free` gives that machine no room, so placement (31) takes another machine with the labels. The context line and `arthur resources` add the free disk (`local: room for 2 more jobs (5.1 GB, 3.4 cores, 41 GB disk free)`). Falling under the floor emits `disk-low` (`machine`, `path`, `free`, `floor`) and one `notice`; running jobs are never stopped for disk, they finish in the reserve the floor keeps.
- Done means: tested against the fake host and a fake `df` on `PATH` that answers in POSIX `df -P` output. Edge cases: free space exactly at the floor starts a job, one KiB under refuses it; floor `0` is no floor; the floor hit mid-job (the running jobs go on, one `disk-low` and one notice, the next spawn there refused, another machine with the labels takes it); free space hovering around the floor emits one `disk-low` per fall under it, not one per check; two paths on one filesystem count once; a provider's path missing on that machine (skipped with one line, the home still counts); `df` output that cannot be read, or a check that fails, counts as no room, said once, as in 34; a machine without Docker counts its home only.
- Depends on: 34.
- Size: half a day to a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

### 83. Findings: what happens to them, per project

- Package: findings.
- Delivers: the `findings.md` format and its reader, out of the core; `provide("findings.onMerge")`, which the merge (54) calls with the open findings; the project option `findings.mode`: `ticket` (one planning ticket each, the default), `grouped` (one planning ticket per merged ticket, every open finding in it), `summary` (no ticket; each finding `deferred (client summary)`, listed in the outcome for the client); `/findings` moves here from 18.
- Done means: tested with real files. Refused at load: an unknown mode. Edge cases: no open finding (nothing made); a finding already `ticket …`, `fixed` or `dropped` (left alone); `grouped` with one finding (one ticket); a project without the plugin (findings stay open, the merge says so once).
- Depends on: 17, 54.
- Size: half a day.
- Covers: none (new: the owner asked for it on 2026-10-16).

## The switch, and the rest of the first version

After entry 83, Arthur switches its first project, itself: it runs on the VPS (`docs/setup.md`) and takes its own tickets, with Telegram as its channel. The other projects follow. The owner decided on 2026-10-19 that voice (81), Discord (89, 90) and Docker (70 to 72), which the harness Arthur replaces does not have, are built right after the switch, still in the first version, before the later entries.

At the switch, `.agents/harness/` (its `criteria/` and `project.json`) is removed, the test in `test/arthur-criteria.test.ts` that compares the two copies is deleted, and the `arthur` project of `arthur.config.example.ts` stops naming `.agents/harness/roles`, so `.agents/arthur/criteria/` holds the one copy of the styleguide and review criteria every role reads (AR0297). Until then an edit of `styleguide.md` or `review.md` in either folder is made in both, which that test checks.

### 81. Voice: local transcription of voice notes

- Package: voice.
- Delivers: the plugin and its options, checked: `model` (default `"small"`: a whisper.cpp model name, the file `.arthur/voice/models/ggml-<model>.bin`, or a path to a `.bin` file), `threads` (default 4), `language` (default `"pl"`; a language code of two or three lower-case letters, or `"auto"` for whisper's own detection), `timeoutSeconds` (default 300), `maxSeconds` (default 600). Through `provide("message.part")` (49) it claims every `voice` part, from any channel. It reads only the file the part names and writes only in its own folder: ffmpeg converts the note to 16 kHz mono WAV under `.arthur/voice/` (removed after), then whisper.cpp (`whisper-cli`) transcribes it on the CPU with `model`, `threads` and `language`; nothing leaves the server. One transcription at a time: a queue, in the order the parts came, each run cut after `timeoutSeconds` (its process killed). The coordinator gets `[voice <seconds> s] <transcript> (<path>)`: whisper's lines joined by spaces, then the original file, kept where the channel saved it; `<seconds>` is the part's `seconds`, else the WAV's length. Its requirements for `arthur doctor` (80), none critical, each costing "voice notes reach the coordinator as paths": `whisper-cli` on `PATH` (fix: build whisper.cpp), the model file (fix: whisper.cpp's `models/download-ggml-model.sh <model>`), `ffmpeg` on `PATH` (fix: install ffmpeg).
- Done means: tested against a fake `ffmpeg` and a fake `whisper-cli` on `PATH` that print and exit as the real ones do. Options refused at load: `threads`, `timeoutSeconds` or `maxSeconds` not a positive whole number, `language` neither such a code nor `"auto"`. Edge cases: an empty or silent note (no text, or only whisper's `[BLANK_AUDIO]`) gives `[voice: no speech] (<path>)`; a note longer than `maxSeconds` is not transcribed, the human gets one line through `reply` (`voice note of <seconds> s is over maxSeconds <maxSeconds>; not transcribed`) and the coordinator `[voice <seconds> s: not transcribed: over maxSeconds] (<path>)`; a failed transcription (ffmpeg or whisper exits non-zero, or the run times out) gives `[voice <seconds> s: not transcribed: <why>] (<path>)`, `<why>` being the last line the tool printed on stderr or `timed out after <timeoutSeconds> s`, and the queue goes on; two notes at once (an album, two messages, two channels) are queued and transcribed one after the other, in order, each turn in its message's order; the model file, `whisper-cli` or `ffmpeg` missing: nothing runs, doctor names it, and the note is passed on as a path, `[voice <seconds> s: not transcribed: <what> missing; see arthur doctor] (<path>)`.
- Depends on: 49, 80.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-16: transcribed locally, never in the cloud, a plugin next to the channels).

### 102. Video: frames and the spoken words of a video part

- Package: video; `packages/video/docs/video.md`.
- Delivers: the plugin and its options, checked, each a positive whole number: `everySeconds` (default 5), `maxFrames` (default 12), `maxSeconds` (default 600), `timeoutSeconds` (default 300). Through `provide("message.part")` (49) it claims every `video` part, from any channel. It reads only the file the part names and writes only in its own folder, `.arthur/video/`, a folder per video: ffprobe reads the length and whether there is a sound track; ffmpeg takes PNG frames, the first, one per `everySeconds` step and each scene change, at most `maxFrames`, each with its second; with a sound track ffmpeg takes it as a 16 kHz mono WAV and the plugin asks voice's `voice.transcribe` (81, AR0550) through the host (`collect`) for its text and segment times, the WAV removed once answered and the frames kept for the coordinator to open; nothing leaves the server. Each ffprobe or ffmpeg step is cut after `timeoutSeconds`. The coordinator gets `[video <seconds> s] (<start>-<end> s) <text> ... frames: <frame> at <s> s, ... (<path>)`, `<path>` the original file, kept where the channel saved it. Its requirement for `arthur doctor` (80), named `ffmpeg`: `ffmpeg` and `ffprobe` on `PATH`, not critical, costing "videos reach the coordinator as paths, without their frames or words".
- Done means: tested against a fake `ffmpeg` and `ffprobe` on `PATH` and a fake host answer for `voice.transcribe`. Options refused at load: any of the four not a positive whole number, an unknown key. Edge cases: no sound track (`[video <seconds> s: no sound] frames: ...`, no WAV taken); no speech (`no speech`); the voice plugin not enabled or refusing, or ffmpeg failing on the sound track (`not transcribed: <why>`, the frames still given); a video over `maxSeconds` is not cut, the human gets one line through the channel it came from (`video of <seconds> s is over maxSeconds <maxSeconds>; not cut`) and the coordinator `[video <seconds> s: not cut: over maxSeconds] (<path>)`; `ffmpeg` or `ffprobe` missing (nothing runs, the part passed on as its path, naming `arthur doctor`); ffprobe or ffmpeg failing or timing out on the video (the part passed on as its path with the tool's last stderr line, the frames taken removed).
- Depends on: 81, 49, 80.
- Size: a day.
- Covers: none (new: the owner approved it on 2026-10-28, AR-D258: a video reaches the coordinator as its frames and words, cut on this server, never in the cloud).

The channel the owner uses (AR0134, 2026-10-18); Telegram stays in the first version as the other channel the config may turn on. Each channel is a plugin, on when the config lists it, and several may be on at once.

### 89. Discord: gateway, text in and out

- Package: discord; `docs/setup.md` gains the Discord step.
- Delivers: `bots` (named instances, like telegram's), each with `tokenEnv`, `guildIdEnv` (the one server it answers), `userIdEnv` (the owner, the one user it answers) and `channelIdEnv` (the main channel). In that server, the main channel is the coordinator's and every other channel is a project's: a message in the main channel becomes `message-received` with no `place`, a message in another channel of the server carries that channel's id as `place` (49), and a send without a `place` goes to the main channel, so the project agents (85, 86) find their channels ready and a project's `chat` names one by its id. Discord's gateway over Node's built-in `WebSocket`, with no runtime dependency (discord.js's docs serve only as a reference), an outbound connection with no Interactions Endpoint URL, so nothing listens: Hello, a heartbeat with jitter, Identify with the GUILDS, GUILD_MESSAGES and MESSAGE_CONTENT intents and no other, and Resume through `resume_gateway_url` after a drop; `coordinator-replied` (to the replies whose `channels` hold `discord`) and `notice` sent through REST `POST /channels/{id}/messages`, at most 2000 characters per message, in slices at line breaks, during quiet hours with `SUPPRESS_NOTIFICATIONS`; a 429 waits as long as its `retry_after` says; an outbox as in 48, under `.arthur/discord/`. Its requirements for `arthur doctor` (80): the token works and the MESSAGE_CONTENT intent is on, both critical; the server requires 2FA for moderation (its `mfa_level`) and has no member but the owner and the bot, neither critical.
- Security (the owner, 2026-10-18, AR0134): the bot answers only the owner's user id, on one server; the server is private (only the owner and the bot) and requires 2FA; the token lives only in the environment, never in the config, a log, an error or a message; the least gateway intents (the three above) and the least permissions (View Channels, Send Messages, Attach Files: the invite URL `docs/setup.md` gives asks for those only); `docs/setup.md` says never to paste a secret in a channel, since Discord keeps every message on its servers.
- Done means: tested against a fake gateway and a fake REST API in the shape of Discord's documentation. Refused at load: a `bots` entry without one of its four variables, naming the option. Edge cases: a missed heartbeat ACK closes the connection and resumes; opcode 7 (reconnect) resumes; opcode 9 (invalid session) identifies again with backoff, and a reconnect loop resumes and never identifies in a tight loop, since Discord resets the bot token after 1000 IDENTIFYs in 24 hours; close code 4014 (disallowed intent) names MESSAGE_CONTENT and the setting in Discord's developer portal; 4004 (bad token) never prints the token; a message from another user, from another server, or from the bot itself is ignored; a direct message to the bot never arrives (no DIRECT_MESSAGES intent); a message the owner forwarded (a `message_reference` of the forward type, the original in `message_snapshots`) is never a phone command (90), as on Telegram (AR0365): its text and the text of its snapshots reach the coordinator after `[forwarded from <author>]`, the original's author when the event names one, else `a hidden sender`, the name cut of control, line and paragraph separator and format characters and of `]`, and one with no text gets the mark alone, after its files; an edit (`MESSAGE_UPDATE`, which GUILD_MESSAGES delivers) is ignored, as Telegram ignores `edited_message`, so an edit to `/stopall` runs nothing and reaches nobody; a channel deleted while a slice for it waits in the outbox sets that slice aside and says so once; until the project agents (86) route by place, a message from a project's channel reaches the coordinator and the reply goes to the main channel; the doctor lines of a server without 2FA or with a third member, each with its fix.
- Also delivers (AR0127): the silent mode of 47, as on Telegram: a reply with no `channels` goes to the main channel, and a notice is sent only when `call("coordinator.silent", notice)` does not hold it; `/silent` is routed as every phone command (90).
- Depends on: 49, 51.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-17; the first-version channel he uses since 2026-10-18, AR0134).

### 90. Discord: media and phone commands

- Package: discord.
- Delivers: attachments become `parts` (49), saved under `.arthur/discord/`; media goes out as multipart `files[n]`, up to 10 files per message and at most 25 MiB per request; `/name text` typed as plain text in the owner's own message, never a forwarded one or an edit (89), is routed to the command registry and the reply sent to its channel. No application commands, so there is no interaction to answer.
- Done means: refused before any send: 11 files, a request over 25 MiB. Edge cases: a message of only an attachment; an unknown command gets the registry's line; a reply longer than 2000 characters is sliced.
- Depends on: 89.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-17; first version since 2026-10-18, AR0134).

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

## Later

### 85. Project agents: their processes and `arthur attach <project>`

- Package: orchestration; projects (the `chat` key); telegram (its `doctor` requirement for topics).
- Delivers: the project key `chat: { plugin, instance?, place }` in `projects`, checked there for its shape only, next to `tracker` (41); its presence turns that project's agent on, and a project without it changes nothing. Each project with a `chat` gets one interactive `omp`, supervised like the coordinator (23), in its own tmux session on the coordinator's socket, named the coordinator's session, `-`, and the project's name; started with `--cwd <project folder>` and `--session-dir <home>/orchestration/<project>/sessions`, so each agent keeps its conversations in its own folder and `--continue` never resumes the coordinator's conversation or a human's `omp` run in the same folder. Its role file is `roles/project-agent.md`: it works like the coordinator, directing that project's jobs through `arthur spawn` and `arthur ticket`, and edits no code itself; `roles.project` gives its model and thinking level (26). Each agent has its own pid file and stop mark, so one crashing in a loop never touches another; the sessions start one after another, so two `omp` never refresh the shared login at once. `arthur attach [<project>]` and `arthur coordinator stop [<project>]`; the doc page tells the owner that each agent takes about 0.7 GB outside the jobs' slice, so `jobs.memory` goes down for each agent added. Telegram's requirement for `arthur doctor` (80), whenever some project's `chat` names it: the bot's `getMe.has_topics_enabled` is true.
- MCP (AR0234): each project agent starts with the servers of `mcp.roles.project`, else `mcp.all` (`mcpServers(options, env, "project")`, orchestration's mcp.ts), through `--plugin-dir` to a folder of its own, as the coordinator does; tested against the fake agent.
- Done means: tested with the fake agent and a tmux socket in the test's folder. Refused at load, naming the projects: a `chat` whose plugin provides no `channel.send`; two projects with one place on one channel; a `chat` of the wrong shape. Edge cases: no project with a `chat` starts only the coordinator, as before; one agent crashing in a loop leaves the coordinator and the other agents running; `attach` of a project without an agent names the projects that have one; topics turned off for the bot (doctor names the setting).
- Depends on: 23, 41, 49.
- Size: a day.
- Covers: none (new: the owner chose it on 2026-10-17, AR0098).

### 86. Project agents: routing, wake, and `arthur agent tell`

- Package: orchestration.
- Delivers: one inbox (24) per session; a `message-received` whose `channel` and `place` some project's `chat` names goes to that project's agent, any other to the coordinator; a session's `coordinator-replied` carries the `place` of the messages it answers, so each reply goes back where they came from; a job's end wakes the agent of the job's project, else the coordinator; a job of a project with an agent that turns blocked on the user sends its `notice` (27) to that project's place; `arthur agent tell <project|coordinator> <text>` puts one message, marked `[from <sender>]`, in another session's inbox, so work across projects passes through the coordinator. The coordinator's role routes work for a project with an agent through `arthur agent tell`, so two agents never act on one project.
- Done means: edge cases: a message for a project whose agent is down waits in its inbox and is delivered once the agent is up; a job of a project whose agent was just removed wakes the coordinator; nothing is delivered twice across a restart of either session; `tell` to an unknown agent is refused, naming the agents that exist.
- Depends on: 85, 24, 27.
- Size: a day.
- Covers: none (new: the owner chose it on 2026-10-17, AR0098).

### 87. Project agents: their context

- Package: orchestration.
- Delivers: entry 25's context for one project, on each of its agent's turns: its vision, a warning per missing criteria file, its board digest, its jobs by state (27), the slots of `maxAgents` in use (`n of maxAgents`, counted across every project), the local time and whether it is night. In the coordinator's context, one line per project agent: up since, or down since.
- Done means: edge cases: a project without a vision file gets a warning line, not a failure; a job of another project never shows in a project agent's context but counts in its slots; an agent down shows as down in the coordinator's context.
- Depends on: 86, 25.
- Size: half a day.
- Covers: none (new: the owner chose it on 2026-10-17, AR0098).

### 88. Session: every session

- Package: session; it asks orchestration for the list of sessions through `provide`.
- Delivers: entries 35 to 38 for each session, the coordinator's and each project agent's: each has its own handoff; a compaction at each `compactAt` runs for the sessions one after another, never in parallel; the coordinator's fresh start waits for every job, as today, and a project agent's only for its project's jobs; `/restart` restarts the session of the chat it was sent from (50); the restart guard holds until every session that loaded the merged code has restarted; each session sends its own start notice to its own chat. The morning report (65) stays with the coordinator.
- Done means: edge cases: a project agent's fresh start is not held back by another project's job; `/restart` from the main chat restarts the coordinator only; one session's failed handoff withdraws only its own compaction; with no project agent, everything behaves as in 35 to 38.
- Depends on: 87, 35, 36, 37, 38.
- Size: a day.
- Covers: none (new: the owner chose it on 2026-10-17, AR0098).

### 73. Signal

- Package: signal.
- Delivers: a channel through `signal-cli` next to Arthur: receive by polling, send text and media, only the allowed number, the `channel.send` and `message-received` contract telegram uses: the same `parts` (49), files saved under `.arthur/signal/`, so voice notes reach the voice plugin (81) and every media plugin as they do from Telegram.
- Done means: tested against a fake `signal-cli` that answers in its documented JSON shape. Edge cases: `signal-cli` missing (one line, the plugin does not start); a message from another number; an attachment too large.
- Depends on: the first version (every first-version entry, those after the switch included).
- Size: a day.
- Covers: none (new).

### 91. Slack: Socket Mode, text in and out

- Package: slack.
- Delivers: named instances, like telegram's `bots`; one Slack workspace (its team id) and, in it, only the owner's user; Socket Mode, an outbound connection with no Request URL, so nothing listens: `apps.connections.open` with the app-level token (`xapp-`), then Node's built-in `WebSocket`; each envelope acknowledged with its `envelope_id` at once; a reconnect on a `disconnect` message or a drop; Events API `message` events become `message-received` with `place` their channel id (49); `chat.postMessage` with the bot token (`xoxb-`), in slices at line breaks; a 429 waits for `Retry-After`; an outbox as in 48, under `.arthur/slack/`.
- Done means: tested against a fake Socket Mode server and a fake Web API in the shape of Slack's documentation. Edge cases: an envelope delivered again (its retry) is handled once; a `disconnect` message opens a new connection with no message lost; a message from another user, another workspace or the bot itself is ignored; neither token ever printed.
- Depends on: 73.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-17).

### 92. Slack: media and the `/arthur` command

- Package: slack.
- Delivers: files in are fetched from `url_private_download` with the bot token and become `parts` (49), saved under `.arthur/slack/`; files out go through `files.getUploadURLExternal`, the upload, then `files.completeUploadExternal`; one slash command, `/arthur <name> <text>`, arrives as a `slash_commands` envelope (no Request URL) and is routed as `/name text` (the owner, 2026-10-17: Slack rejects an unknown `/` command typed as text, so one registered command carries them all; it is one line in the app's manifest).
- Done means: edge cases: `/arthur` with no name answers with the list of phone commands; an unknown name gets the registry's line; a failed upload step names the step and sends nothing half.
- Depends on: 91.
- Size: a day.
- Covers: none (new: the owner asked for it on 2026-10-17).

### 74. WhatsApp through a local bridge

- Package: whatsapp.
- Delivers: a channel through a bridge on loopback (receive by polling, send text and media, only the allowed number), with the `channel.send` and `message-received` contract telegram uses: the same `parts` (49), files saved under `.arthur/whatsapp/`, so voice notes reach the voice plugin (81) and every media plugin as they do from Telegram; refuses a bridge URL that is not loopback.
- Done means: tested against a fake bridge. Edge cases: a bridge URL on a public address refused at load; the bridge down (said once, retried); the session logged out.
- Depends on: 92.
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

### 77. Web panel: the board, jobs, events and chat in a browser

- Package: server (its web page; the same plugin as 75 and 76).
- Delivers: the board, the jobs with their states, the events and the coordinator's chat in a browser, served by `server` (75, 76) on the Tailscale network only; Tailscale identifies who connects, so the panel keeps no passwords.
- Done means: refused at load: a bind address that is neither loopback nor Tailscale's `100.64.0.0/10` or `fd7a:115c:a1e0::/48`. Edge cases: a request from outside the Tailscale network is refused with no detail; the panel's job states are the ones `arthur jobs` prints; its events are the ones 75 streams; a command run from the panel gives the reply `arthur <cmd>` gives.
- Before any code (the owner, 2026-10-16): the panel is planned with the owner first: the frontend libraries it uses, if any, and why each (the core and the other plugins keep no runtime dependencies), how it is built and served, and the screens; the owner approves the plan.
- Depends on: 76.
- Size: several days.
- Covers: none (new: the owner asked for it on 2026-10-16).

### 95. Own apps: a mobile app (Expo) and the web panel by the VPS's Tailscale name

- Package: a mobile app built with Expo, in its own folder outside the npm workspaces or in its own repository, as its plan decides (an Expo app needs runtime dependencies, which entry 1 refuses in Arthur's packages); server (75 to 77): the name the apps reach it by.
- Delivers: the owner's own apps reach Arthur on the VPS by its Tailscale name (MagicDNS, `<host>.<tailnet>.ts.net`), never by a public address or port: the web panel (77) in a browser, and the mobile app on the owner's phone with Tailscale on. Both talk only to `server`, the event stream (75) and the commands (76), with the token; the mobile app shows the board, the jobs by state, the coordinator's chat and the notices, as the panel does. HTTPS on that name, with the certificate Tailscale issues for it (`tailscale serve` or `tailscale cert`), since iOS and Android refuse plain HTTP to a remote host by default. `docs/setup.md` gains the Tailscale step for the VPS and the phone.
- Done means: refused at load (server): a bind address that is neither loopback nor Tailscale's (77). Edge cases: the phone off the tailnet, or Tailscale off, gets one line that says so, not an endless wait; the app reconnects from its last sequence and misses nothing (75); the token is kept in the phone's secure storage, never in the app's code, a log or a crash report; a command run from the app gives the reply `arthur <cmd>` gives; nothing of Arthur answers on the VPS's public address (a request to it from outside the tailnet).
- Before any code (the owner, 2026-10-18, AR0134): the app is planned with the owner first, as the panel (77) is: where its code lives and its dependencies, the screens, how it reaches the phone (a development build, TestFlight, a store), and whether a notification may reach the phone through a push service (Expo's, Apple's, Google's: its text leaves the VPS) or the app reads the stream only while it is open; the owner approves the plan.
- Depends on: 77.
- Size: several days; to be split into its own entries when it is planned.
- Covers: none (new: the owner asked for it on 2026-10-18, AR0134).

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
| Y1 | YouTrack: issues, articles, fields, work items, comments, attachments, links, tags, search, moves, sub-articles; delete by the coordinator, never by a job; ids checked; token hidden | 44, 45, 46 |
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
| S8 | The VPS recipe | 8; `docs/setup.md`, each step with its check, and `arthur setup`, 94; its step after install, `arthur doctor`, 80 |

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
| Node version per project | `nvm`, the project's `.nvmrc` | 84 |
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
