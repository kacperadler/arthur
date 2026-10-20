# The plugin API

What a plugin may use of the core, frozen by roadmap entry 51 (AR0228) as the plugins built by then use it, schedule, youtrack and telegram among them. From here a change to anything below, a host member, a type, what a module of `@arthur/core` exports, a core event's fields or a provided name's shape, is a decision recorded in the ticket that makes it.

`test/plugin-api.test.ts` holds this page to the code: each module in `packages/core/package.json`'s `exports` has a section below whose `Exports:` line names exactly what the module exports, and the host a plugin gets has exactly the members of "The host". A plugin imports `@arthur/core` through these modules only, never another plugin (`test/structure.test.ts`).

## A plugin

A plugin package exports a function from its options to a `Plugin`, which the config's `plugins` list holds:

```ts
import type { Plugin } from "@arthur/core/plugin";
import { checkOptions } from "./schedule-options.ts";

export function schedule(options: ScheduleOptions = {}): Plugin {
	return { name: "schedule", module: import.meta.url, options, check: checkOptions, setup(host) { /* register */ }, start() { /* timers */ }, stop() { /* end them */ } };
}
```

| Key | What it is |
| --- | --- |
| `name` | Lowercase letters and dashes; one plugin per name in a load. |
| `module` | Its own module's `import.meta.url`: `host.code` then holds the package folder around it, and `host.package` is that folder. |
| `options` | As written in the config. `enabled: false` means the host neither loads the plugin nor reads its env variables. |
| `requires` | The plugins it needs: each must be in the list and enabled, and its `setup` runs first. |
| `after` | The plugins whose `setup` runs first when they are loaded; one missing or disabled is no refusal. |
| `check(options, core)` | Its own options, `enabled` left out, and the core's as loaded; it returns `{ path, problem }` for each wrong one, and every problem refuses the start. |
| `doctor(options, core)` | Its requirements read from the same, without its setup or its env values, so `arthur doctor` and `arthur setup` check them while the load refuses. |
| `setup(host)` | Registers: commands, kinds, roles, checks, provided names, subscriptions. A `host.jobs.spawn` before every plugin's `setup` has run throws `<plugin>: spawn during setup; start jobs from start() or later`. |
| `start()` | Long-lived work (a poll, a timer); called only by `arthur run`, in setup order. |
| `stop()` | Ends it; called by `arthur run` on SIGTERM, in reverse order. |

## The host

What `setup` gets, one host per plugin. `@arthur/core/testing`'s `fakeHost` gives a plugin's tests the same members.

| Member | What it is |
| --- | --- |
| `name` | The plugin's name. |
| `options` | Its options as written, `enabled` left out. |
| `env` | Its own `...Env` variables that are set, by variable name. A value never goes into an error or a log line. |
| `folder` | `<home>/<plugin>/`, created before `setup`; no other plugin reads or writes it. |
| `agent` | `core.agent.command`, the agent a plugin starts outside a job (the coordinator). |
| `code` | The package folders this load runs: the core's, then each enabled plugin's around its `module`. |
| `package` | This plugin's own package folder, when it names its `module`. |
| `events.on(name, fn)` | Subscribes `fn` to the events named `name`, in this process and, under `arthur run`, those another process appended to the log. |
| `events.emit(name, data)` | Appends the event, named by this plugin, to `<home>/events.jsonl`, then delivers it; returns it as logged (`Event`). |
| `events.read(fromSeq)` | The logged events from sequence number `fromSeq` on, oldest first. |
| `provide(name, fn)` | Answers `name` for the other plugins ("Provided names"). Several plugins may provide one name. |
| `call(name, ...args)` | The one provider's answer; refused when none or several provide it. |
| `collect(name, ...args)` | Every provider's answer, in setup order; none is an empty list. |
| `collectEach(name, ...args)` | The same, each as an `Answer` with its plugin, a provider that throws costing its own answer only (`error`). |
| `commands.register(command)` | A `Command`, run as `arthur <name>`, and with `phone` also as `/name text` on a channel. Two plugins registering one name is refused. |
| `commands.route(text, from?)` | A channel's `/name text`: the phone command's reply, or one line naming the unknown command or the error. `from` is a `PhoneFrom`. |
| `commands.phone()` | The phone commands, `{ name, about }` each, for a channel's menu. |
| `jobs.registerKind(kind)` | A `Kind` this plugin owns. |
| `jobs.registerRole(role)` | A `Role` whose prompt this plugin ships; its kinds name it. |
| `jobs.registerExtension(url)` | An OMP extension, its module's `file:` URL, that each job's agent loads with `-e` after the core's own, in the order registered (above, "Changes since entry 51"). |
| `jobs.beforeSpawn(check)` | A `SpawnCheck` asked before any record exists; a reason refuses the spawn. |
| `jobs.prepare(fn)` | A `Prepare` run after the worktree and record exist, before the agent starts, here, acting on another machine through `jobs.run`; a throw removes both and refuses the spawn. The variables it returns go into the job's environment only and reach the prepares after it; `arthur continue` runs it again with `continued` true. |
| `jobs.registerMachine(machine)` | A `Machine` jobs run on over SSH; `local` is the core's. |
| `jobs.run(machine, argv, limitSeconds?, input?)` | One command on a registered machine, `input` on its stdin; resolves to a `Ran`. |
| `jobs.machines()` | The names of the registered machines. |
| `jobs.spawn(request)` | A job from a `SpawnRequest`; resolves to `Started` once its wrapper started. |
| `jobs.block(id, reason, stop?)` | Holds a job in a run `blocked` on `dependency: <reason>` until its run ends; with `stop`, on `user: <reason>`, and stops the run, resolving once it is over. Refused for an empty reason and a job not in a run. |
| `jobs.list()` | Every project's `JobRecord`, in any state, the newest spawn first. |
| `jobs.running()` | The ids of the jobs in a run: working, idle, or held. |
| `jobs.result(id)` | Job `id`'s final message, empty while it runs or when it wrote none. |
| `jobs.file(id, job)` | `arthur ticket file <id> <job>`: the finished job filed in ticket `id`'s folder by its kind's `file`; the path written. |
| `jobs.prompt(role, project?)` | The prompt a role's job gets in a project, `{ prompt, warnings }`. |
| `jobs.vision(project?)` | A project's vision, `{ project, path, text?, problem? }`. |
| `jobs.criteria()` | The names of the criteria files the registered roles read, each once. |
| `board.projects()` | The checked project list, from the plugin that provides `projects`; the first is the main one. |
| `board.list(project?)` | A project's tickets (`Ticket`), in the order they were created; the main one when left out. |
| `board.get(id)` | A ticket by its full id, its prefix naming the project; undefined when none has it. |
| `board.create(title, project?)` | A new ticket in planning, its `ticket.md` from the template; emits `ticket-created`, named by this plugin. |
| `board.move(id, to)` | Moves a ticket as the board's transitions allow; emits `ticket-moved`, named by this plugin. |
| `board.digest(project?)` | Every open ticket, the 10 newest merged, and one line counting the rest. |
| `board.full(project?)` | Every ticket. |
| `clock.timeZone` | `core.timeZone`: one clock for every plugin, in that time zone with `core.quietHours`. |
| `clock.now()` | Now, a `Date`. |
| `clock.local(at?)` | A `LocalTime`: the wall clock's `date`, `time` and `day` in the time zone. |
| `clock.isQuiet(at?)` | Within `core.quietHours`, across midnight when `from` is the later time; never without them. |
| `clock.next(time, days?)` | The first `"HH:MM"` slot strictly after now, only on `days` (`Day`s) when given. |

Removed by entry 51, since no plugin used them: `jobs.unblock(id)` (a hold now ends with its run, or with `stop`), and `board.after(id, ids)`, which only `arthur ticket after` sets.

### Changes since entry 51

Each decided in the ticket that made it.

- AR0235 (roadmap 52, the owner on 2026-10-20): `Kind.verdicts`, the lines a finished run's final message may end on, exactly; a run whose last line is none of them ends `failed: no verdict: the last line of its final message is not <a> or <b> alone` in its record, `arthur jobs` and `job-ended`, instead of `finished`. A list of lines, not a function: the wrapper that writes the state runs apart from the plugins, on another machine too, so the kind's judgement goes into the record (`verdicts`) at the spawn. Delivery's `review` uses `["PASS", "FAIL"]`.
- AR0235 (roadmap 52, the owner on 2026-10-20): `SpawnRequest.fetch`, the hex id of a commit of the project's repository besides HEAD that the job needs on its machine (a review's branch tip); on another machine it is pushed to `refs/arthur/fetch` with the base when the repository there lacks it. One that is no commit here refuses the spawn: `fetch: "<value>" is no commit of <repository>; give its hex id`.
- AR0237 (roadmap 53, which names it; approved with the roadmap): `jobs.registerExtension(url)`, an OMP extension each job's agent loads with `-e`, after the core's env guard, worktree guard and steer extension, in the order the plugins registered theirs. The spawn keeps them in the record as `extensions`, each a path from the core's `src/`, which the wrapper resolves where it runs: the wrapper runs apart from the plugins, on another machine too, whose Arthur is a checkout of the same commit (docs/deploy.md). A URL that is not `file:`, or names no file, is refused at registration: `extension <url>: expected the file: URL of a module that exists, as new URL("./<file>.ts", import.meta.url) gives`. Delivery's job checks use it (`arthur review-needed --help`).

## Types

The types a plugin meets through the host, published by `@arthur/core/plugin`:

| Type | What it is |
| --- | --- |
| `Options` | A plugin's options, a read-only record. |
| `OptionProblem` | `{ path, problem }`: one wrong option, its path from the plugin's options (`instances[1].url`). |
| `Requirement` | `{ name, check(), costs, fix, critical? }`: one thing a plugin needs (`arthur doctor`); `check` answers `ok`, `ok (<detail>)` or `missing: <reason>`. |
| `Provider` | What `provide` takes: any function. |
| `Answer` | `{ plugin, value }` or `{ plugin, error }`: one answer of `collectEach`. |
| `Event` | `{ seq, time, plugin, name, data }`: an event as logged. |
| `Command` | `{ name, doc, run, phone? }`: `doc` the URL of the page `arthur <name> --help` prints, `run(input)` writes its output and returns the exit code, `phone: { about, reply(text, from) }`. |
| `CommandInput` | `{ args, project }`: what `run` gets; `project` is `--project`, undefined for the main one. |
| `PhoneFrom` | `{ channel?, place?, instance? }`: where a phone command came from, its channel's plugin, the place in it, and the named bot. |
| `Kind` | `{ name, readOnly, role, budgetUsd?, timeoutMinutes?, resumeOnBudget?, verdicts?, file? }`: a kind of job; `verdicts` the lines its final message may end on (above, "Changes since entry 51"); `file(filing)` files a finished one. |
| `Filing` | `{ ticket: { id, path, root }, job: { id, kind, base, result } }`: what a kind's `file` gets. |
| `Role` | `{ name, file, criteria }`: a role, its file a URL the plugin ships, the criteria files it reads by name. |
| `SpawnRequest` | `{ task, kind?, project?, model?, thinking?, timeoutMinutes?, budgetUsd?, machine?, requires?, ignoreRestart?, fetch? }`; `fetch` a commit the job needs on its machine (above). |
| `Spawn` | A spawn as `beforeSpawn` checks it: `task`, `kind`, `project`, `model`, `modelWhy?`, `thinking`, `quick`, `timeoutMinutes`, `budgetUsd`, `free`, `tickets`, `machine`, `ignoreRestart`. |
| `SpawnCheck` | `(spawn) => reason | undefined`, or a promise of it. |
| `Job` | A `Spawn` with its caps, `id`, `root`, `base`, `branch` (undefined for a read-only kind) and `worktree`: what a `Prepare` gets. |
| `Started` | A `Job` with the prompt's `warnings` and `failed`, why its wrapper did not start. |
| `Prepare` | `(job, env, continued) => variables | void`, or a promise of it. |
| `Machine` | `{ name, ssh, home, labels }`. |
| `Requires` | `{ os?, arch?, tools? }`: the labels a job needs. |
| `Ran` | `{ code, stdout, stderr }`: what `jobs.run` resolves to. |
| `JobRecord` | `id`, `kind`, `project`, `state`, `reason`, `hold`, `since`, `branch`, `machine`, `cost`, `budget` (text, as in the record), `tickets` and `seconds`. |
| `Project` | `{ name, path, prefix }`. |
| `Ticket` | `{ id, title, status, path, updated, after?, project }`. |
| `Plugin`, `Host` | The two shapes above. |

## Core events

Emitted by the core, named `core` unless said otherwise; `data` holds the fields.

| Event | Fields | When |
| --- | --- | --- |
| `job-started` | `id`, `kind`, `project`, `root`, `branch`, `worktree`, `tickets`, `machine` | A spawn or `arthur continue`, as it starts the job's wrapper. |
| `job-state` | `id`, `project`, `ticket` (the id its task names, or null), `machine`, `from`, `to`, `reason` | A job's state changed: `working`, `idle`, `blocked`, `ended`. |
| `job-ended` | `id`, `kind`, `project`, `state` (`ended` or `blocked`), `reason`, `undelivered?` (the steers it never got) | A run ended. |
| `stop-all` | `ids` | `arthur stopall`, before it stops them. |
| `ticket-created` | `id`, `project`, `title`, `status`, `path` | A ticket was created; named by the plugin whose `host.board` created it, else `core`. |
| `ticket-moved` | `id`, `project`, `from`, `to` | A ticket moved; named by the plugin whose `host.board` moved it, else `core` (`arthur ticket`, a worker's start). |
| `ticket-after` | `id`, `project`, `after` | `arthur ticket after` changed what a ticket waits for. |
| `notice` | `text` | Something the owner must know: a machine running jobs without a systemd scope, a critical requirement missing at `arthur run`. |
| `doctor` | `lines` | The requirements missing at `arthur run`'s start, none critical. |

The events plugins share, which channels and the coordinator keep (`arthur send --help`, "Channels"; `@arthur/core/parts`):

| Event | Fields | Emitted by |
| --- | --- | --- |
| `message-received` | `channel`, `parts` (each `Part`), `place?`, `instance?` | A channel, once per owner's message. |
| `coordinator-message` | `text` | A plugin with a message for the coordinator (schedule). |
| `coordinator-replied` | `text`, `answers` (the event numbers it answers), `channels`, `place?` | Orchestration, after a turn; a claimed part's `reply`. |
| `notice` | `text`, `place?` | Any plugin; every channel sends it unless `coordinator.silent` holds it. |

## Provided names

The names plugins provide and ask for today; who provides, who asks, and what the answer is.

| Name | Provided by | Asked by | The answer |
| --- | --- | --- | --- |
| `projects` | projects | the core (`host.board`, a spawn's checkout), plugins | The project list. |
| `prompt` | commit-rules, projects, youtrack | the core, `collect` at a spawn | A section of the prompt for `(role, job)`. |
| `doctor` | machines, models, nvm, projects | the core (`arthur doctor`) | `Requirement`s that need the plugin's setup. |
| `jobs.place` | machines | the core, each spawn | The machine a job runs on. |
| `jobs.limits` | resources | the core, each spawn | The job's own caps. |
| `jobs.keep` | none yet | the core (`arthur prune`) | Whether an ended job's record is kept. |
| `models.pick` | models | the core, each spawn with a model | `{ model, why, free }` for `(list, machine)`. |
| `roles.model` | orchestration | the core, session | `{ model, thinking, quick, mcp }` of a role; `mcp` its MCP servers in omp's `mcpServers` shape (AR0234). |
| `message.part` | none yet (voice) | the core (`turnText`) | A `Claim` for a part it handles. |
| `channel.send` | telegram | the core (`arthur send`) | A check of `{ files, caption?, place? }` that throws every refusal, or a function that sends. |
| `ticket.autopilot` | orchestration | the core (`arthur ticket status --autopilot`) | The pre-approval. |
| `coordinator.context` | models, projects, resources, session | orchestration | Lines of the coordinator's context. |
| `coordinator.wake` | delivery, orchestration, projects | orchestration | Lines of the wake for an ended job. |
| `coordinator.extension` | session | orchestration | `{ file, env }`: an OMP extension the coordinator loads. |
| `coordinator.restart` | orchestration | session | Restarts the coordinator, `{ fresh }`. |
| `coordinator.silent` | orchestration | telegram | Whether the silent mode holds a notice. |
| `models.lists` | orchestration | models | Every role's model list. |
| `machines.round` | resources | machines | A round of machine checks as it begins. |
| `resources.free` | resources | machines | The jobs a machine has room for. |
| `schedule.register` | schedule | orchestration | Registers another plugin's schedule entries. |
| `merge.check` | projects | none yet (delivery) | A check of a job's branch before its merge. |
| `delivery.alwaysReview` | delivery | orchestration | `{ project, paths }`: the paths on the always-review list. |
| `health` | manage | manage (`arthur health`, its rounds), session | Lines of what should have happened and has not: a line or a list of lines. |

## Option tables and `./options`

Each package's `./options` export is its options file: it exports `table` (an `OptionTable`), `summary` (one line: what the package is) and `tools` (a `Tool` each it runs), and loads without setting up anything; `arthur setup` reads it by path. The package's own `check` walks the same `table`, so an option without its meaning cannot exist.

An `OptionEntry` is a `ValueOption`, `{ about, default?, check, each?, keys? }`, or an `ObjectOption`, `{ about, default?, fields }`; `about` and `default` are one line each, as a person reads them. A list or record of objects has the table of its items' keys in `each`. A record may name keys of its own in `keys`, each checked by its own entry instead of `each` (AR0178): orchestration's `roles.quick` is no role, and `roles.quick.model` has its own line. `everyOption` walks a table at any depth: a nested option after its parent, a list's or record's items under `*`, then a record's own keys by name.

## Modules

### `@arthur/core`

Exports: `ArthurConfig`, `CoreOptions`, `LoadedConfig`, `QuietHours`, `coreVersion`, `defineConfig`, `describe`, `loadConfig`, `memoryBytes`.

`defineConfig(config)` types `arthur.config.ts` (`ArthurConfig`: `core` as `CoreOptions`, with `QuietHours`, and `plugins`); `loadConfig(path)` loads and checks one, every core option set (`LoadedConfig`). `describe(value)` is a value as an error names it (`"text"`, `a list`, `3`). `coreVersion()` is what `arthur version` prints. `memoryBytes(text, total)` is systemd's `MemoryMax` syntax in bytes, undefined when systemd would refuse it.

### `@arthur/core/cli`

Exports: none.

The `arthur` binary. A plugin resolves its path (`import.meta.resolve`) to run a command in a process of its own.

### `@arthur/core/clock`

Exports: `Clock`, `Day`, `LocalTime`, `clock`.

`clock(timeZone, quietHours, now?)` makes a `Clock` like `host.clock`, for code that runs outside a host.

### `@arthur/core/env-guard`

Exports: `default`.

The env guard, an OMP extension, which the coordinator loads with `-e` like every job.

### `@arthur/core/lock`

Exports: `queueLock`, `takeLock`, `withLock`.

A lock between processes on one machine, a file holding its holder's pid, taken over from a dead one. `withLock(path, run, waitMs?)` holds it while `run` runs; `takeLock(path)` takes it now or names its holder, for as long as a process runs; `queueLock(path, waitMs?)` waits for it without blocking and resolves to its release.

### `@arthur/core/option-table`

Exports: `Check`, `ObjectOption`, `OptionEntry`, `OptionTable`, `Tool`, `ValueOption`, `everyOption`.

"Option tables and `./options`" above. A `Check` returns what a value should be, or undefined when it is; a `Tool` is `{ name, version }`, the command that prints its version.

### `@arthur/core/options`

Exports: `summary`, `table`, `tools`.

The core's own options file.

### `@arthur/core/parts`

Exports: `Claim`, `Kind`, `NOT_TRANSCRIBED`, `Part`, `Received`, `received`, `turnText`.

The channels' contract (`arthur send --help`, "Channels"). A `Part` is `{ kind, path?, text?, mime, seconds? }`, its `Kind` one of `text`, `photo`, `video`, `voice`, `audio`, `file`; `Received` is a `message-received` event's data, which `received(data)` checks, answering what is wrong with it as text; `turnText(host, seq, message)` makes a message the coordinator's text, asking `message.part` for each part that is not text; `NOT_TRANSCRIBED` is a voice part's line when no plugin claims it.

### `@arthur/core/plugin`

Exports: `Answer`, `Command`, `CommandInput`, `Event`, `Filing`, `Host`, `Job`, `JobRecord`, `Kind`, `Machine`, `OptionProblem`, `Options`, `PhoneFrom`, `Plugin`, `Prepare`, `Project`, `Provider`, `Ran`, `Requirement`, `Requires`, `Role`, `Spawn`, `SpawnCheck`, `SpawnRequest`, `Started`, `Ticket`.

The plugin shape, the host and their types: "A plugin", "The host" and "Types" above.

### `@arthur/core/testing`

Exports: `AgentRun`, `AgentStep`, `FakeHost`, `fakeAgent`, `fakeHost`, `jobSlice`, `temporaryFolder`.

The test kit, which `npm test` loads into every test process as its safety net. `fakeHost({ name, options?, env?, timeZone?, quietHours?, now?, root?, code? })` is one plugin's host alone, with what the plugin registered, called and emitted, and the test as another plugin (`call`, `collect`, `provide`, `emit`), `setNow` for its clock and `continue` for `arthur continue`. `fakeAgent(run)` is an `omp` that plays an `AgentRun` of `AgentStep`s; `temporaryFolder()` a folder removed at exit; `jobSlice` the test's own systemd slice.
