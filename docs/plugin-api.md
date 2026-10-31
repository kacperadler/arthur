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
| `piece(value, options)` | Its check of one project's piece, the value its `<name>.project(...)` helper made in that project's file, with its own options (`enabled` left out): a problem, or undefined. Having it declares the piece. Below, "Project pieces". |
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
| `secrets` | The values, never the names, of every enabled plugin's `...Env` variables that are set, from the shell or the env file, for redacting a text that may carry one (above, "Changes since entry 51"). |
| `folder` | `<home>/<plugin>/`, created before `setup`; no other plugin reads or writes it. Inside a job's sandbox it cannot be read (AR0590): a file of it that a `setup` or an in-job command reads there must count as none when the read fails. |
| `agent` | `core.agent.command`, the agent a plugin starts outside a job (the coordinator). |
| `job` | Inside a job (`arthur help --help`), `{ id, project }`: the job's id and the project its record in the home names, `""` for a record this home does not hold; undefined outside a job (`arthur run`, the coordinator). The projects plugin then serves that project alone. |
| `sandbox(folder, cache, note)` | For branch code a plugin runs outside a job (delivery's checks on main): a function from a shell command to the command and arguments that run it by `sh -c` in a sandbox writing only in the checkout `folder` (each entry there is, but `.git`, Arthur's home, `arthur.config.ts` and the env file; of `.git` its `objects`, `refs`, `logs` and `index`, never its `config`, `hooks` or `info`; `arthur merge --help`, "Checks on main"), the folder `cache`, made if missing, where the package managers' caches go (`npm_config_cache`, `BUN_INSTALL_CACHE_DIR`, `XDG_CACHE_HOME`, `PNPM_HOME` and `COMPOSER_CACHE_DIR` point into it; the plugin's own, which it removes when done), the temporary folder and `/dev`, reading every file but the env file and `~/.ssh`, and no other process's environment (`arthur spawn --help`, "The sandbox"). Where it cannot be set up, `note` gets one line, `no sandbox: <why>; each step writes wherever Arthur's user can`, and the command runs bare, its caches in `cache` still (above, "Changes since entry 51"). |
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
| `commands.docs()` | Every registered command, the core's and each plugin's, `{ name, doc }` each by name, `doc` the URL of the page `arthur <name> --help` prints (above, "Changes since entry 51"). |
| `jobs.registerKind(kind)` | A `Kind` this plugin owns. |
| `jobs.registerRole(role)` | A `Role` whose prompt this plugin ships; its kinds name it. |
| `jobs.registerExtension(url)` | An OMP extension, its module's `file:` URL, that each job's agent loads with `-e` after the core's own, in the order registered (above, "Changes since entry 51"). |
| `jobs.beforeSpawn(check)` | A `SpawnCheck` asked before any record exists; a reason refuses the spawn. |
| `jobs.prepare(fn)` | A `Prepare` run after the worktree and record exist, before the agent starts, here, acting on another machine through `jobs.run`; a throw removes both and refuses the spawn. The variables it returns go into the job's environment only and reach the prepares after it; `arthur continue` runs it again with `continued` true. |
| `jobs.registerMachine(machine)` | A `Machine` jobs run on over SSH; `local` is the core's. |
| `jobs.run(machine, argv, limitSeconds?, input?)` | One command on a registered machine, `input` on its stdin; resolves to a `Ran`. |
| `jobs.machines()` | The names of the registered machines. |
| `jobs.home(machine)` | Arthur's home folder on a registered machine, the core's own on `local`; refused for a name no plugin registers (above, "Changes since entry 51"). |
| `jobs.slice` | The name of the jobs' systemd slice without `.slice`: `arthur-jobs`, or the one `ARTHUR_JOB_SLICE` names (`arthur spawn --help`); the test kit's own (`jobSlice`) under `fakeHost`, which the kit also sets as `ARTHUR_JOB_SLICE` (above, "Changes since entry 51"). |
| `jobs.spawn(request)` | A job from a `SpawnRequest`; resolves to `Started` once its wrapper started. |
| `jobs.continue(id, instruction, budgetUsd?)` | `arthur continue` of an ended job with a branch, `budgetUsd` replacing its budget, through every `beforeSpawn` and `prepare` as at the CLI; resolves to why its wrapper did not start, undefined once it started (above, "Changes since entry 51"). |
| `jobs.block(id, reason, stop?)` | Holds a job in a run `blocked` on `dependency: <reason>` until its run ends; with `stop`, on `user: <reason>`, and stops the run, resolving once it is over. Refused for an empty reason and a job not in a run. |
| `jobs.list()` | Every project's `JobRecord`, in any state, the newest spawn first. |
| `jobs.running()` | The ids of the jobs in a run: working, idle, or held. |
| `jobs.prune(ids)` | `arthur prune <id>...` of those jobs: each ended one's worktree, branch and record freed as far as Git and `jobs.keep` allow, one line `<id>: <what was done>` each; any id that names no job refuses them all before anything is removed (above, "Changes since entry 51"). |
| `jobs.result(id)` | Job `id`'s final message, empty while it runs or when it wrote none. |
| `jobs.file(id, job)` | `arthur ticket file [<id>] <job>`: the finished job filed by its kind's `file`, in ticket `id`'s folder, or, `id` undefined, where the kind keeps a job of no ticket; the path written (above, "Changes since entry 51"). |
| `jobs.prompt(role, project?)` | The prompt a role's job gets in a project, `{ prompt, warnings }`. |
| `jobs.vision(project?, checkout?)` | A project's vision, `{ project, path, text?, problem? }`; read in `checkout`, a folder holding a copy of the project's repository, when given (above, "Changes since entry 51"). |
| `jobs.criteria()` | The names of the criteria files the registered roles read, each once. |
| `board.projects()` | The checked project list, from the plugin that provides `projects`; the first is the main one. |
| `board.list(project?)` | A project's tickets (`Ticket`), in the order they were created; the main one when left out. |
| `board.get(id)` | A ticket by its full id, its prefix naming the project; undefined when none has it. |
| `board.create(title, project?)` | A new ticket in planning, its `ticket.md` from the template; emits `ticket-created`, named by this plugin. |
| `board.move(id, to)` | Moves a ticket as the board's transitions allow; emits `ticket-moved`, named by this plugin. |
| `board.digest(project?, checkout?)` | Every open ticket, the 10 newest merged, and one line counting the rest; the board in `checkout`, a folder holding a copy of the project's repository, when given (above, "Changes since entry 51"). |
| `board.full(project?, kind?)` | Every ticket; with `kind`, every ticket of that Kind (above, "Changes since entry 51"). |
| `board.kinds` | The kinds a ticket's `- Kind:` line may name, the ticket template's. |
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
- AR0241 (F1 of AR0239, the owner on 2026-10-21): the provided name `projects.install`, by projects, asked by delivery's `arthur merge`: `{ project, commit }`, a project's name and a commit of its repository, to the command that installs it there, the one a new worktree of that commit gets (its `install`, else its one known lockfile's frozen install), `""` for none; two known lockfiles and no `install`, or a project not in the list, throw. The merge runs it on main in place of its own lockfile table, which went.
- AR0242 (F2 of AR0239, the owner on 2026-10-21): the provided name `nvm.path`, by nvm, asked by delivery's `arthur merge`: `{ root }`, a project's checkout on this machine, to the PATH a worktree of it here gets, the bin of the Node its `.nvmrc` names (`nvm which`) before the PATH as it is, `""` without `.nvmrc`; each refusal of nvm's prepare throws, `machine local` in it. The merge asks it before its steps on main and again before the reinstall after a reset, and runs them with that PATH; without a provider, on the PATH as it is.
- AR0246 (roadmap 58, which names the pushes; built with AR0238): the provided name `github.push`, `{ project, branch }` to a promise of one line, which delivery asks with `collect` after a review's `PASS` and after `arthur merge` went in, so a load without github pushes nothing and delivery never imports github. No host member changed. The github plugin's `ci-finished` gained `attempt` (GitHub's `run_attempt`), told once per `<run id>/<attempt>`, and its new event `pull-request-review`; both wake the coordinator through `coordinator-message` when its `wakeOn` names them.
- AR0247 (roadmap 55, which names the hand-back's continue; the ticket's Done means allow a new member recorded here): `jobs.continue(id, instruction, budgetUsd?)`, the runner's `arthur continue` given to plugins, without `--ignore-restart`, which stays the CLI's: the same refusals, a `beforeSpawn` reason as `refused by <plugin>: <reason>`, so `maxAgents` holds for it. Delivery continues a worker with a FAIL review's findings (`arthur review --help`, "Hand-back"). The test kit's `FakeHost.continue`, which did the same for a test, is gone: a test calls `host.jobs.continue`.
- AR0253 (roadmap 59, which names CI "asked of github through `call`"): the provided names `github.ci` and `github.cancel`, by github, asked by delivery's `arthur merge --auto` and its CI waits. `github.ci`: `{ project, branch }` to a promise of the run that built the branch as `arthur ci` finds it, `{ id, attempt, sha, branch, status, conclusion, url, startedAt, below }` (`startedAt` GitHub's `run_started_at`, else `created_at`; `below` the commits from the tip to the one it ran on), undefined for none; a project without `ci.workflow`, a branch not in its checkout, and GitHub's refusal reject. `github.cancel`: `{ project, run }` to a promise of one line once GitHub took the cancel; its refusal rejects. Asked with `call`, so a load without github refuses `--auto` unless `--no-ci`, and delivery never imports github. No host member changed; delivery now has a `stop`.
- AR0254 (roadmap 64, which runs the core's prune on a schedule; the ticket's Done means allow a new member recorded here): `jobs.prune(ids)`, the runner's `arthur prune <id>...` given to plugins, its lines and refusals the CLI's; `--all` stays the CLI's, so a plugin names each job it frees. Manage's daily prune of `prune.keepJobsDays` uses it (docs/manage.md in its package).
- AR0261 (roadmap 62, which files an audit with `arthur ticket file`, by kind, in `spec/quality/`; the ticket's Done means allow a host change recorded here): `arthur ticket file <job>` and `jobs.file(undefined, job)` file a finished job whose task names no ticket by its kind's `file`, which then gets `Filing.ticket` undefined; a job whose task names a ticket is refused without it (`<job>'s task names <ids>; file it in its ticket: arthur ticket file <id> <job>`). `Filing.root`, the project's folder, replaces `Filing.ticket.root`, so a filing of no ticket has it too. Manage's `audit` uses it (docs/manage.md in its package); orchestration's and delivery's filers read `root`.
- AR0251 (the ticket's Done means: a test that the hand-back ends on delivery's own refusal and still retries another plugin's): the test kit's `FakeHost.beforeSpawn(check)`, the test as the plugin `test` refusing a spawn (`refused by test: <reason>`), since a check through `host.jobs.beforeSpawn` refuses as the plugin itself. No host member changed.
- AR0262 (roadmap 69, which counts each machine's `home`; the ticket's Done means allow a new member recorded here): `jobs.home(machine)`, the `home` a `Machine` was registered with, `<home>` itself on `local`, which no member gave a plugin; a name no plugin registers is refused as a spawn's `machine` is, `unknown machine <name>; machines: <names>`. The resources plugin reads the free disk of that folder's filesystem there. The provided name `resources.disk`, asked by resources with `collect` at each check of a machine with a disk floor: `(machine)` to an absolute path, or a list of them, on that machine that its jobs write (docker: its data root, entry 70), or a promise of either.
- AR0257 (F1 of AR0253: one wake per CI run end): the provided name `delivery.ciEnded`, by delivery, asked by github's poll with `collect` for each branch of a run that ended, before its own wake: `{ project, branch, below, run }` (`run` as `github.ci` gives it, without `below`), to `true` when a CI wait that `arthur merge --auto` left counts that run and delivery woke the coordinator with its verdict (once per run attempt), else `false`; github leaves a `true` branch out of its wake. Delivery's poll no longer tells a run's end. No host member changed.
- AR0278 (F2 of AR0276; the ticket's Done means allow a new member recorded here): `commands.docs()`, every registered command with its doc page's URL, which no member gave a plugin (`commands.phone()` lists the phone commands only). Develop's `arthur eval` reads them so its stub answers `arthur <command> --help` and `arthur help <command>` with the page the live CLI prints (docs/commands/eval.md in its package).
- AR0279 (F3 of AR0276; its Done means name orchestration's context for a given checkout, which reads the checkout's board and vision): `board.digest(project?, checkout?)` and `jobs.vision(project?, checkout?)`, a project's board and vision read in `checkout`, a folder holding a copy of its repository, where no member read anywhere but the project's own checkout; and the provided name `coordinator.checkoutContext`, by orchestration, asked by develop's `arthur eval` for each run's copy of its fixture at the scenario's hour.
- AR0294 (F1 of AR0279; its Done means name orchestration taking a scenario's context in `coordinator.checkoutContext`): that provided name takes `{ root, at, context }`, `context` `{ <plugin>: <text> }`, the lines each plugin adds in place of its live answer, none for a plugin left out, a name that answers no `coordinator.context` refused; develop's `arthur eval` passes the scenario's `context`. No host member changed.
- AR0353 (F1 of AR0323; its Done means name the field): `Command.inJob`, `true` or absent, any other value refused at registration; inside a job (`ARTHUR_JOB` set) the CLI runs only a command registered with `inJob: true` and refuses the rest before it runs (`arthur help --help`). No host member changed.
- AR0378 (the ticket's Done means: the board shows each ticket's Kind and filters by it): `board.full(project?, kind?)`, every ticket of that Kind when `kind` is given, a kind not in `board.kinds` refused (`unknown kind <kind>; kinds: <kinds>`); `board.kinds`, the kinds of the ticket template (`feat`, `fix`, `security`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`, `ux`), which orchestration's `/board`, delivery's changelog and findings read. The lines of `board.digest` and `board.full` carry each ticket's Kind after its status.
- AR0380 (its Done means: the repository's own Git config checked against an allowed set before `arthur merge` and a push, which delivery and github make): the module `@arthur/core/git-config`, `configRefusal(root)`, the one check the core's own checkout and push share with those plugins, so the allowed set is kept once. No host member changed.
- AR0340 (F4 of AR0319; its Done means name `host.secrets`): `secrets`, every enabled plugin's set `...Env` values, so a plugin redacts a value of the env file, which Arthur's own environment never holds. The session plugin's notices and orchestration's inbox notice and decision log redact them, besides their own shape rules. The test kit's host gives its own `env` values as `secrets`.
- AR0354 (F2 of AR0323; its Done means name one function in the core): the module `@arthur/core/inside-job`, `insideJob(home)`, the mark of a job that its shell cannot clear under systemd; the CLI's `inJob` gate and the refusals of `decision`, `youtrack`, `plugin new`, `schedule`, `ci --rerun` and `remote-job` ask it in place of `ARTHUR_JOB`. No host member changed.
- AR0373 (AR0311 F14; its Done means: the install of a new worktree and the merge's steps run inside a job scope): `jobs.slice`, the jobs' slice, which no member gave a plugin, so delivery runs each step of `arthur merge` in a transient scope under it (`systemd-run --user --scope --slice=<slice>.slice`) and a test's merge stays out of Arthur's own slice. A prepare's variable `ARTHUR_INSTALL` is a command the job's wrapper runs first, inside the job's scope; the projects plugin's install returns it instead of running through `jobs.run` (`arthur spawn --help`).
- AR0449 (AR0440's Risks and Open questions; its Done means: each check of a merge in a sandbox of its own, through what the core publishes): `sandbox(folder, note)`, the sandbox a job's install runs in, for branch code a plugin runs outside a job, with the core's env file hidden, which no member gave a plugin; delivery runs each step of `arthur merge` in it, inside the step's scope. A prepare's `ARTHUR_INSTALL` now runs in the job's sandbox too (`arthur spawn --help`, "The sandbox"). The test kit's host hides `<root>/env`, its jobs' env file.
- AR0454 (F1 of AR0449; its Done means: the install and each merge step get a cache of their own, in a folder of that job or of that merge, removed after it): `sandbox(folder, cache, note)`, `cache` the folder the package managers' caches of those commands go to, in place of the shared ones every process of Arthur's user reads (`~/.npm`, whose `_npx` a later `npx` runs, `~/.bun/install/cache`, pnpm's, uv's and composer's), which the sandbox no longer lets them write. Delivery's `arthur merge` gives each merge its own in its folder, `<delivery folder>/cache-<random>`, and removes it after the last step. A job's install keeps its caches in its record's `cache` folder.
- AR0518 (its Done means: no env file value in a job's record or log, an error or a channel's message): each value of an enabled plugin's `...Env` variable, from the shell or the env file, 8 characters or more, becomes its variable's name in what `events.emit` logs and delivers, in the task, instruction, reason and text of `jobs.spawn`, `jobs.continue`, `jobs.block` and the core's steer, in the record's prompt with the `prompt` sections, in the reply of `commands.route`, in the caption `channel.send` gets, in the error of a `setup` that throws, and in every text the CLI prints; a job's wrapper names the values of its env file in each file of the record it writes and its events. A plugin that needs a value keeps it from `env`. No host member changed.
- AR0589 (AR-D391, its approved plan): `Plugin.piece(value, options)`, and each project's `pieces` and `folder` in what the projects plugin provides as `projects` (below, "Project pieces").
- AR0593 (AR0589's approved plan, ticket 2): `host.job`, `{ id, project }` inside a job; the projects plugin serves the job's own project alone there, imports no other project's file, and outside a job keeps `<home>/projects/folders` beside `checkouts`, which a job's sandbox reads (`arthur spawn --help`, "The sandbox"). `loadPlugins` takes the job's id in place of a flag.
- AR0590 (AR0589's approved plan, ticket 3): inside a job's sandbox a plugin reads nothing of its `folder` nor of the rest of the home but the job's own record, the records of its project and the projects plugin's lists; `host.jobs.list()` there gives those records alone (`arthur spawn --help`, "The sandbox").
- AR0557 (AR0556's approved plan, Option 2; its Done means: `arthur github pr --help` prints `github-pr.md`): a command's group page, `<doc>-<word>.md` beside its `doc`, which `arthur <command> <word> … --help` prints when it exists and `<word>` is lowercase letters, digits and dashes, else the command's `doc` (`arthur help --help`). A plugin registers nothing more for it. No host member changed.

### Project pieces

Each project has a folder of its own with its `project.config.ts` (`arthur projects --help`, "A project's file"): a list of pieces, each made by a plugin's helper, `<plugin>.project(value)`, which only returns `{ <plugin name>: value }`; accounts and tokens stay in the plugin's own options in `arthur.config.ts`. A plugin with something per project:

- exports the helper beside its function: `dokploy.project = (piece: DokployPiece) => ({ dokploy: piece })`, the key its own `name`;
- declares `piece(value, options)`, its check of one project's piece. Before that plugin's `setup` the host runs it on every project's `pieces[<name>]` it gets from `collect("projects")`, and a problem refuses the load naming the project and the helper: `plugin dokploy: setup failed: project shop: dokploy.project(...): <problem>`. So a plugin with `piece` sets up after `projects` (`requires` or `after`), and its setup never sees a malformed piece. The test kit's fake host runs it the same way in `setup(plugin)`;
- reads its piece in its setup, or later, from the projects it collects: `project.pieces.dokploy`. No plugin imports another, and the projects plugin checks none but its own, `projects.project(...)`.

A piece that no loaded plugin with `piece` reads, a disabled plugin's or a key written by hand, is a line of `arthur doctor`, never critical (`arthur doctor --help`): inside a job a plugin whose variable is unset is not loaded, and its pieces must not break the job's commands, so its pieces are not checked there.

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
| `Command` | `{ name, doc, run, phone?, inJob? }`: `doc` the URL of the page `arthur <name> --help` prints, and beside it `<doc>-<word>.md`, a group's page, the one `arthur <name> <word> --help` prints; `run(input)` writes its output and returns the exit code, `phone: { about, reply(text, from) }`, `inJob: true` when it runs inside a job too (above, "Changes since entry 51"). |
| `CommandInput` | `{ args, project }`: what `run` gets; `project` is `--project`, undefined for the main one. |
| `PhoneFrom` | `{ channel?, place?, instance? }`: where a phone command came from, its channel's plugin, the place in it, and the named bot. |
| `Kind` | `{ name, readOnly, role, budgetUsd?, timeoutMinutes?, resumeOnBudget?, verdicts?, file? }`: a kind of job; `verdicts` the lines its final message may end on (above, "Changes since entry 51"); `file(filing)` files a finished one. |
| `Filing` | `{ root, ticket?: { id, path }, job: { id, kind, base, result } }`: what a kind's `file` gets; `root` the project's folder, `ticket` undefined for a job of no ticket (above, "Changes since entry 51"). |
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
| `job-steered` | `id`, `kind`, `text`, `via` (`steer` or `continue`) | `arthur steer` (or `/steer`) queued a correction, or `arthur continue` started a run; a plugin's `host.jobs.steer` or `continue` emits none. |
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
| `coordinator-message` | `text` | A plugin with a message for the coordinator (schedule, github). |
| `coordinator-replied` | `text`, `answers` (the event numbers it answers), `channels`, `place?` | Orchestration, after a turn; a claimed part's `reply`. |
| `notice` | `text`, `place?` | Any plugin; every channel sends it unless `coordinator.silent` holds it. |

## Provided names

The names plugins provide and ask for today; who provides, who asks, and what the answer is.

| Name | Provided by | Asked by | The answer |
| --- | --- | --- | --- |
| `projects` | projects | the core (`host.board`, a spawn's checkout, a plugin's `piece`, `arthur doctor`), plugins | The projects, inside a job only the job's own (`host.job`), each with its `folder`, the real path of its project folder, and its `pieces`, every other plugin's piece of its file by plugin name (above, "Project pieces"). |
| `prompt` | commit-rules, develop, findings, manage, projects, youtrack | the core, `collect` at a spawn | A section of the prompt for `(role, job)`. |
| `doctor` | delivery, discord, machines, models, nvm, projects | the core (`arthur doctor`) | `Requirement`s that need the plugin's setup. |
| `jobs.place` | machines | the core, each spawn | The machine a job runs on. |
| `jobs.limits` | resources | the core, each spawn | The job's own caps. |
| `jobs.keep` | github, delivery | the core (`arthur prune`) | Whether an ended job's record is kept; asked once its worktree and branch are freed, so a provider also frees what it holds of the job: github deletes its branch on origin, delivery its folder of the job (AR0555). |
| `models.pick` | models | the core, each spawn with a model | `{ model, why, free }` for `(list, machine)`. |
| `roles.model` | orchestration | the core, session (its LLM probe), develop (`arthur eval`) | `{ model, thinking, quick, mcp }` of a role; `mcp` its MCP servers in omp's `mcpServers` shape (AR0234). |
| `message.part` | listen, video | the core (`turnText`) | A `Claim` for a part it handles. |
| `listen.transcribe` | listen | listen (`arthur transcribe`), video (a video's sound track, through `collect`: none answering is the listen plugin not enabled), any plugin | A promise of `{ seconds, text, segments }` for a file's path, each segment `{ start, end, text }` in seconds; rejects with why it was not transcribed (`docs/listen.md`). |
| `channel.send` | telegram | the core (`arthur send`), manage (`/retro`, only the channel the command came from) | A check of `{ files, caption?, place? }` that throws every refusal, or a function that sends. |
| `ticket.autopilot` | orchestration | the core (`arthur ticket status --autopilot`) | The pre-approval. |
| `coordinator.context` | develop, findings, manage, models, projects, resources, session | orchestration | Lines of the coordinator's context. |
| `coordinator.wake` | delivery, manage, orchestration, projects | orchestration | Lines of the wake for an ended job, asked with the job-ended data and its final message. |
| `coordinator.extension` | session | orchestration | `{ file, env }`: an OMP extension the coordinator loads. |
| `coordinator.restart` | orchestration | session | Restarts the coordinator, `{ fresh }`. |
| `coordinator.silent` | orchestration | discord, telegram | Whether the silent mode holds a notice. |
| `coordinator.turn` | orchestration | develop (`arthur eval`) | A promise of the text the coordinator's agent gets for `(event name, data, result)`, one event handed over alone. |
| `coordinator.checkoutContext` | orchestration | develop (`arthur eval`) | `{ root, at, context }`, a copy of the main project's repository, a `Date` and `{ <plugin>: <text> }`: the coordinator's context there at that instant, without the live jobs, open decisions and silent mode, each plugin's lines `context`'s instead of its live answer (above, "Changes since entry 51"). |
| `models.lists` | orchestration | models | Every role's model list. |
| `machines.round` | resources | machines | A round of machine checks as it begins: a `Map` of each machine's name to the paths its check's df reads (AR0269). |
| `resources.free` | resources | machines | The jobs a machine has room for. |
| `resources.disk` | none yet (docker) | resources, each check of a machine with `keepFree.disk` | `(machine)`: the absolute paths there its jobs write, besides its home (above, "Changes since entry 51"). |
| `schedule.register` | schedule | orchestration, manage | Registers another plugin's schedule entries. |
| `schedule.message` | schedule | develop (`arthur eval`) | `(id, message, procedure text)`: the text the coordinator gets for that action due on time, `[scheduled <id>] <message>` with the procedure's text under a blank line. |
| `projects.install` | projects | delivery (`arthur merge`) | `{ project, commit }`: the command that installs the project at that commit, as a new worktree gets it, `""` for none (above, "Changes since entry 51"). |
| `nvm.path` | nvm | delivery (`arthur merge`) | `{ root }`, a project's checkout here: the PATH with its `.nvmrc`'s Node first, `""` without `.nvmrc` (above, "Changes since entry 51"). |
| `merge.check` | projects, orchestration | delivery (`arthur merge`, `arthur review-needed`) | A check of a job's branch before its merge: a text answer refuses it. |
| `decision.owner` | orchestration | delivery (`arthur merge --unreviewed` or `--no-ci`, `arthur take-main`) | `{ id, what, kind, ticket?, job?, use }`: `""` when `id` is the owner's own answered decision of that kind, ticket or job, not used by another use, which it then marks used; else the refusal, one line. |
| `findings.onMerge` | findings | delivery (`arthur merge`) | `{ project, ticket, path, root }`, `path` the merged ticket's `findings.md`: the lines of its outcome's `## Left open`. |
| `delivery.alwaysReview` | delivery | orchestration | `{ project, paths }`: the paths on the always-review list. |
| `github.push` | github | delivery (a review's PASS, `arthur review-needed`'s `no review`, `arthur merge`) | A promise of one line: the branch pushed to origin, or why not. |
| `github.ci` | github | delivery (`arthur merge`, `--auto` or not, its CI waits) | `{ project, branch }`: a promise of the run that built the branch with `below`, or undefined (above, "Changes since entry 51"). |
| `github.cancel` | github | delivery (its CI waits) | `{ project, run }`: a promise of one line once GitHub took the cancel (above, "Changes since entry 51"). |
| `delivery.ciEnded` | delivery | github (its poll, as a run ends) | `{ project, branch, below, run }`: whether a CI wait counts the run and delivery woke the coordinator for it (above, "Changes since entry 51"). |
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

### `@arthur/core/git-config`

Exports: `configRefusal`.

`configRefusal(root)`: `""` when the Git config of the repository at `root` itself, its `.git/config`, the main checkout's `config.worktree` (read once `extensions.worktreeConfig` is on) and any file they include, sets only keys that name no program; else one line naming the file and the first key that may (a filter, a merge driver, a credential helper, `core.sshCommand`, `gpg.program`, an alias, an include, any key outside the set), or Git's own line when it cannot read that config. A job can write that config and not the user's own, so a git call of Arthur's in a checkout that may run a program (a checkout, a merge, a reset, a push or fetch) asks first and runs nothing on a refusal. The allowed set and why: [`deploy.md`](deploy.md), "Threat model".

### `@arthur/core/inside-job`

Exports: `insideJob`.

`insideJob(home, cgroup?, env?)`: the id of the job of Arthur's home `home` this process runs in, undefined outside one. Under systemd it is the job's scope, `arthur-job-<id>.scope` on the last line of `/proc/self/cgroup` (`cgroup`), which no process of the job can change, when `<home>/jobs/<id>` exists; else, a job run bare, the folder name of the record `ARTHUR_JOB` names (`env`, default `process.env`), which a job's shell can clear. Each refusal of a command inside a job asks it, a plugin with its home as `dirname(host.folder)`. Why the scope: [`deploy.md`](deploy.md), "Threat model".

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

Exports: `AgentRun`, `AgentStep`, `FakeHost`, `fakeAgent`, `fakeHost`, `jobSlice`, `temporaryFolder`, `until`.

The test kit, which `npm test` loads into every test process as its safety net. `fakeHost({ name, options?, env?, timeZone?, quietHours?, now?, root?, code? })` is one plugin's host alone, its `secrets` the values of `env`, with what the plugin registered, called and emitted, and the test as another plugin, `test` (`call`, `collect`, `provide`, `emit`, and `beforeSpawn`, whose reason refuses as `refused by test: <reason>`), and `setNow` for its clock. `fakeAgent(run)` is an `omp` that plays an `AgentRun` of `AgentStep`s; `temporaryFolder()` a folder removed at exit; `jobSlice` the test's own systemd slice. `until(what, predicate, { deadlineMs? })` is a test's one wait: it checks `predicate` every 20 ms and returns its first value other than `undefined` and `false`, and past `deadlineMs` (default 20 s) throws `waited <seconds> s for <what>`. `test/structure.test.ts` refuses a test file's own `until`, a loop that sleeps, and more fixed waits (`sleep`, `setTimeout`, `Atomics.wait`) than the file's baseline there.
