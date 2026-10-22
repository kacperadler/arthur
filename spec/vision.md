# Arthur: one core, many plugins

Arthur is a small core that runs agent jobs in isolated Git worktrees and keeps the ticket board, and plugins that switch on everything else from one config file. It rebuilds, as a public project, the harness its owner runs today, cut along that boundary. Diagrams: `docs/architecture/core-and-plugins.mmd`, `docs/architecture/config-flow.mmd`, `docs/architecture/versions.mmd`. Example config: `arthur.config.example.ts`. The order of the work: `spec/roadmap.md`.

## Purpose

One human directs many agents through one coordinator, who does not read code: the human creates the work, says when it is done, keeps each project's vision.

The core itself does no orchestration. The coordinator is the `orchestration` plugin, and it is always loaded: Arthur refuses to start without it, and `enabled: false` on it is refused. Everything else is a plugin the owner turns on, with its own options.

## What stays true

- One human directs many agents; the human creates the work, decides when it is done, keeps each project's vision. The rules about approval and merge are options of the `orchestration` and `delivery` plugins, not core code.
- The coordinator is always on, and it talks with the user in the main chat: through a channel plugin (Discord, the owner's pick, or Telegram; the config turns on the ones he uses) or through the terminal, where the human attaches to the coordinator's own session (`arthur attach`). Several channels may be on at once; none is required, since the terminal is always there. There is no mode without a coordinator. A project may also have its own agent (decision 20), which talks in that project's own chat and works only on that project; the coordinator keeps `maxAgents`, the morning report and the work across projects.
- Work happens in isolated worktrees, on their own branches.
- Plain files in git and in the home folder (`.arthur/`) are the truth: tickets, the board, job records. No database.
- Arthur starts with an empty board. Nothing of the predecessor's tickets, outcomes, reviews or reports is carried over.
- Projects are declared in `arthur.config.ts`, and nowhere else: each one's path or repository, ticket prefix, tracker instance, commit rules and other settings are options of the `projects` plugin. There is no separate JSON file for them. Adding a project is an edit of the config, reviewed like code.
- The agent is OMP. The core runs `omp`; there is no agent-adapter layer.
- Arthur is English only: code, docs, and everything it says to the user (channel messages, reports, prompts). The human may write in any language; Arthur answers in English.
- Arthur exposes nothing to the internet: no public endpoint, no webhook receiver, no public port. Every plugin calls out (Telegram and GitHub are polled, Discord's gateway is an outbound connection) or talks to a local process. Other machines are reached over SSH on a private network (Tailscale), never over the internet; the owner's own apps, later, reach Arthur over the same network by the VPS's Tailscale name.
- One config file, `arthur.config.ts`: the plugin list, each plugin with its options. It holds no secret: an option ending in `Env` names the environment variable that holds it. The values stay in the shell or `.env`, which is never committed. Variables are `ARTHUR_<PLUGIN>_<WHAT>`, e.g. `ARTHUR_YOUTRACK_TOKEN`. A plugin with several accounts (YouTrack servers, Telegram bots, GitHub accounts) lists named instances, each with its own variables, `ARTHUR_<PLUGIN>_<INSTANCE>_<WHAT>`, e.g. `ARTHUR_YOUTRACK_ACME_TOKEN`; one instance may omit its name and use the short form. A project names its instance.
- Core and each plugin are tested apart: the core against a fake plugin and a fake agent, a plugin against a fake host. A plugin never imports another plugin or the core's internals, only the core's published interface; it talks to the core and, through it, to others.
- It runs on a VPS as a process, and may run jobs on other machines it reaches over SSH. Running it needs Node and OMP, no runtime dependencies.
- It stays small enough for one person to understand from its map: the core has a line budget, and each plugin has its own.
- The repository is public, on GitHub: `git@github.com:kacperadler/arthur.git`.
- What reaches GitHub is about Arthur alone (the owner, 2026-10-17): no committed file names a client, another project of the owner, its folders, or the work done for it. The owner's real project list lives only in `arthur.config.ts`, which Git ignores; examples, tests and plans use made-up names.

## The coordinator and its options

The `orchestration` plugin is the coordinator: one interactive `omp` in its own tmux session, started again whenever it ends. It directs every project in the `projects` list that has no agent of its own, and the work across projects; its limits count across all of them. A project with a `chat` in `projects` gets its own agent: one more interactive `omp`, supervised the same way, in the project's folder, which directs that project's jobs and answers in that chat. What remains configurable:

| Option | Does |
| --- | --- |
| `maxAgents` | The most jobs running at once, across all projects and machines together. Enforced, not only a rule in the prompt. With `resources` on it is the upper bound: fewer start when the machines' free resources say so. |
| `coordinator`, `roles` | Model and thinking level of the coordinator, of each project agent (`roles.project`) and of each role (worker, reviewer, planner, auditor, retro, onboarding), and the quick model; the coordinator's tmux session and restart timing. |
| `plan` | The budget of a plan for a large ticket (planner role, plan review). |
| `autopilot` | The budget of a pre-approved job and its cap. |
| `morningReport` | When the morning report is sent; registers a schedule entry. |

The core keeps what is not a decision about directing: the limits of one job (time, budget) and of all jobs together (CPU, memory). A job's own CPU and memory, the caps of a feature, and how many jobs the free resources allow belong to the `resources` plugin.

## Core and plugins

The core, always on:

| Part | Does |
| --- | --- |
| Config loader | Loads `arthur.config.ts`, checks every plugin's options, resolves the `...Env` names against the environment. Refuses to start on a missing required variable, a missing plugin dependency (including `orchestration`), an unknown option. |
| Plugin host | Calls each enabled plugin with the host API; a plugin subscribes to events, emits events, reads its options and env, and reads the project list. A disabled plugin is not loaded. |
| Command registry | A plugin registers its commands, each with its doc page (what `arthur <cmd> --help` prints) and, where it has one, a phone command (`/jobs`, `/health`, `/restart`). A channel only routes `/name text` to the host and sends the reply; it imports no other plugin. |
| Terminal | Every registered command runs from a shell as `arthur <cmd>`; `arthur attach`, which `orchestration` registers, opens the coordinator's session. |
| Job runner | One job in one worktree on one branch, on this machine or another one over SSH: spawn `omp`, its log, its state (working, idle, blocked, ended), limits (time, budget, CPU and memory in one joint slice), stop, continue, steer. Finds a job whose process is gone and fails it. A plugin registers the kinds of job it owns (review, audit, plan, ...). Removes a worktree in one place, whoever asks (prune, merge, a dropped ticket), after the cleanup hooks plugins register. |
| Ticket board | Tickets as files, the board as one JSON, changed only through the core's own command. Ids are the project's `prefix` and a number, from 1. |
| Prompt loader | Builds each role's prompt: the role file a plugin ships, a project's own override, then the project's criteria files. |
| Event stream | Every state change (job started, ended, ticket moved) is an event from day one, so a server plugin can come later without changing the core. |
| Clock | `timeZone` and `quietHours`, read by every plugin through the host: schedule, session, channels, orchestration. |
| Env guard | Keeps a job's agent from reading the env file (`.env`), so a secret stays with the process that needs it. |
| Worktree guard | In every job, refuses a write into the main checkout, the home folder or another job's worktree. |
| Test kit | A fake host and a fake agent, published as `@arthur/core/testing`, so each plugin is tested against them without importing another plugin. |

Plugins. First = in the first version, later = after it. Named = the owner named it; derived = added because the harness Arthur replaces already does it.

| Plugin | First or later | Does |
| --- | --- | --- |
| orchestration (named) | first, always on | The coordinator: its session process and `arthur attach`, the options above, wake on job end, the planning of large tickets, autopilot. Later, an agent per project with a `chat`, and the routing of that chat to it (roadmap 85 to 88). |
| machines (named) | first | The machines jobs run on: `local`, where Arthur runs, and others reached over SSH on a private network, each with labels (os, arch, tools); places each job on a machine that has the labels its project or ticket requires. Below. |
| models (named) | first | Model providers on other machines (Ollama or OpenAI-compatible, loopback, private or Tailscale only) and each role's ordered model list, the first available at spawn. |
| resources (named) | first | Caps per job (CPU, memory) and per feature (CPU, memory, time, money), how many jobs start from each machine's free resources, below `maxAgents`, and a floor of free disk per machine. Below. |
| session (named) | first | The coordinator's conversation: compaction at 08:00, 13:00 and 18:00 whatever jobs run, a fresh start at 23:00 once no job runs (tried again every 15 minutes, skipped that night after 03:00), each after a handoff the next conversation reads first (work in progress, next steps, unanswered questions to the human), `/restart` and `/restart fresh`, the restart guard, the start notice and LLM probe. |
| schedule (named) | first | A module for actions and jobs at set times: an entry is a daily time or a one-off date and time, and does an action (a message to the coordinator, optionally a named procedure) or a job (spawn one of a kind). Other plugins register their own entries from their options; hand-added ones live in a file. |
| projects (named) | first | The project list, declared in the config: path or repo, ticket prefix, tracker instance, commit rules, auto-merge, CI workflow, vision and criteria paths. Onboarding of a new repository. |
| nvm (named) | first | Each project's Node version, from its `.nvmrc`, first on its jobs' `PATH` through nvm on the job's machine. |
| findings (named) | first | The `findings.md` format, and what happens to a merged ticket's open findings, per project: a planning ticket each, one per merged ticket, or a summary for the client; `/findings`. |
| commit-rules (named) | first | Each project's commit format, set by a regex, a plain-words rule, or a path to a Markdown file that describes it. Below. |
| youtrack (named) | first | One entry per server; reads and writes issues, comments, articles, work items. |
| telegram (named) | first | A channel: receive, send text, send media. Follows the coordinator's silent mode (`/silent`, roadmap 47): while it is on, sends only the end of the work the owner delegated, its stop condition met, a decision, and the answer to his own message. |
| discord (named) | first | A channel, through Discord's gateway: an outbound WebSocket, no Interactions Endpoint URL. One private server: a main channel for the coordinator and one channel per project; the bot answers only the owner. The channel the owner uses (decision 21). |
| voice (named) | first | Local transcription of voice parts with whisper.cpp: claims every `voice` part from any channel, on the CPU, nothing sent to the cloud. |
| uptime (named) | first | Checks each project's sites over HTTP while `arthur run` runs; one notice when a site goes down (2 failed checks in a row) and one when it is back, with `uptime-down` and `uptime-up` events; this machine offline is told apart from a site down. Roadmap 98. |
| delivery (derived) | first | Review, always-review list, merge after PASS and green CI, the changelog. |
| github (derived) | first | Polls CI runs and pull requests, wakes the coordinator. |
| manage (named: managing Arthur) | first | The audit, the retro, health, prune, stats. Its options (`audit.days`, `retro.day`) make the schedule entries, not prose in one. |
| develop (named: developing Arthur) | first | A command that creates a plugin, evals of the coordinator's turns. |
| docker (named) | first | Labels the Docker resources a job creates with its id and removes them with its worktree, on every machine; keeps the build cache under a cap; a daily sweep of leftovers. Below. |
| signal (named) | later | A channel, through signal-cli. |
| slack (named) | later | A channel, through Slack's Socket Mode: an outbound WebSocket, no Request URL; phone commands as `/arthur <name> <text>`. |
| whatsapp (named) | later | A channel, through a local bridge. The official Business API is out: it delivers incoming messages by webhook. |
| server (named) | later | The core's events and commands over HTTP and a stream, for clients: the web panel, the owner's own mobile app (Expo), a T3 Code-like UI. Bound to a private network and reached by the VPS's Tailscale name, with a token. |

Order of the later plugins, cheapest first: signal (a local process), then slack (an official bot, no ban risk, but a gateway client that has to stay alive), then whatsapp (an unofficial bridge: the account may be banned), then server (needs a stable event protocol and auth), and the owner's own apps on it. Project agents (roadmap 85 to 88) come before all of them, once the other projects have moved to Arthur.

The core never assumes a project is a Git repository or that a single human approves everything, so the company edition (roadmap 79) is plugins on the same core.

## Commit rules

Each project sets one rule in its `projects` entry, `commitRules`, in one of three forms:

| Form | Example | How it is enforced |
| --- | --- | --- |
| `regex` | `^(?=.{1,72}$)(feat\|fix\|docs)(\([\w-]+\))?!?: .+$` | A `commit-msg` git hook in the project's worktrees refuses a subject that does not match, and says the rule. |
| `words` | `Start with the ticket id, then a verb in the imperative.` | Given to the worker and the reviewer in their prompts; the review judges it. A model cannot refuse a commit as a hook does, so a miss is a review finding, not a refusal. |
| `file` | `docs/commit-rules.md` | The Markdown file is read as `words`, from the project's own repository, so the rule is versioned with it. |

A project with no `commitRules` has none. The plugin never edits a project's own git configuration outside Arthur's worktrees.

## GitHub without webhooks

Arthur polls: the github plugin asks for the CI runs of the branches in play every `poll.everySeconds` (120 in the example) and emits `ci-finished` once per run attempt (a rerun keeps the run's id); the coordinator wakes on it. A project names the workflow to watch in its `ci` option. The cost is the interval's delay before the coordinator learns a run ended. Nothing listens for GitHub, so there is no secret to check and nothing to expose. If webhooks ever return, they come back as a decision of the owner, with the exposure explained first.

## Job state, machines and resources

The owner asked for these three on 2026-10-16. The roadmap builds job state and jobs on another machine into the core right after the job runner, and the `machines` and `resources` plugins right after orchestration.

### Job state

Home: the core's job runner; shown by `orchestration` and the channels. Every job is in one of four states, with a reason and since when:

| State | Means |
| --- | --- |
| working | The agent is in a turn: output or a tool call within the last `jobs.idleMinutes`. |
| idle | Its process is alive and not blocked, but has done nothing for `jobs.idleMinutes`: likely stuck. |
| blocked | It cannot go on until something outside it happens: the user (a question its run ended with, its feature's cap reached) or a dependency (another ticket or job, its machine offline). |
| ended | Nothing more will happen: finished, failed, stopped, a limit hit, process gone. |

A run ends blocked when the first line of its final message is `Blocked: user <question>` or `Blocked: on <ticket or job id>`; `arthur continue` resumes it. Interface: the record's `state`, the `job-state` event on each change, `host.jobs.block(id, reason)` for a plugin that holds a job until its run ends, `arthur jobs` and `/jobs`. The coordinator's context lists the jobs that have not ended by state, its wake says the state a run ended in, and a job blocked on the user is a `notice` every channel sends.

### Several machines

Home: the core's job runner runs a job on a machine; the `machines` plugin declares the machines and places each job. Arthur and the coordinator run on one machine, `local`. Arthur reaches the others with `ssh` over a private network (Tailscale), with the user's own keys and `~/.ssh/config`: ssh never asks for a password and never accepts a host key on its own, and a machine whose address is not private is refused. Nothing listens for Arthur anywhere.

Each machine has labels: `os` (`linux`, `macos`), `arch`, `tools` (`xcodebuild`, `docker`, ...), and a `maxJobs`. A project (`requires` in `projects`) or a ticket (`requires` in its JSON block) names the labels its jobs need, and every job of it is placed on an online machine that has them: most jobs on Linux, an iOS build or a macOS check run on a Mac. `--machine` picks one by hand, checked against the labels.

A machine needs Node, git, OMP logged in with its own credential, and the same version of Arthur's core; Arthur sends it no secret. The core pushes the base commit there over SSH, runs the worktree, the wrapper and the guards there, copies the job's record back on each sweep, and fetches the branch back when the job ends. A machine offline mid-job holds its jobs blocked for `jobs.offlineGraceMinutes`, then fails them and keeps their worktree there. Interface: `host.jobs.registerMachine`, `provide("jobs.place")`, `machine-online` and `machine-offline`, `arthur machines`, `/machines`, `arthur spawn --machine` and `--requires`.

### Resources

Home: the `resources` plugin. A job's time and money stay the core's limits (`jobs.timeoutMinutes`, `jobs.budgetUsd`), and so does the joint slice that keeps all jobs from starving the coordinator.

- Per job: `perJob.cpu` and `perJob.memory`, on the job's own scope. A job over its memory cap ends `limit: memory`; CPU is slowed, not stopped. On macOS, which has no systemd, memory is sampled and CPU is not capped.
- Per feature, all jobs of one ticket together: `perFeature.budgetUsd`, `hours`, `cpu`, `memory`; a ticket's `caps` replace them for that ticket. At the cap, spawns for the ticket are refused and its running jobs are stopped and held blocked until the human raises the cap.
- How many jobs: each machine's free CPU and memory. A job starts only when its machine keeps `keepFree` after the job's reservation (its `perJob` caps); the coordinator sees each machine's room in its context and decides how many to start. `maxAgents` stays the upper bound across all machines.
- Free disk: under `keepFree.disk` on a machine, no job starts there. Below, with Docker.

Interface: `beforeSpawn` refusals that name the shortfall, `provide("jobs.limits")` read by the core's job scope, `provide("resources.free")` read by placement, the `cap-reached` and `disk-low` events, one context line per machine, `arthur resources`, `/resources`.

## Disk space and Docker

The owner asked for this on 2026-10-16: jobs that build and run containers again and again fill the disk, and when it is full no agent can work. On the harness Arthur replaces, that day: Docker's build cache 31.7 GB (21 GB reclaimable), images 9.5 GB (4 GB reclaimable), 127 volumes (91% reclaimable), the disk 66% used with 41 GB free.

Home, and why:

- The disk floor: the `resources` plugin. Free disk is one more resource of a machine, beside CPU and memory: measured at the same machine check, refused through the same `beforeSpawn`, shown in the same context line, and needed whether Docker is there or not.
- Docker's resources: a small `docker` plugin. Labels, cleanup and the sweep are Docker's own commands, needed only on machines labelled `tools: docker`; in `resources` they would double its size with code that is about Docker, not about room. The core knows no Docker: it stays a job runner and gives one hook, `host.jobs.cleanup(fn)`, run on the job's machine before its worktree is removed, wherever the removal comes from (prune, merge, a dropped ticket).

Labels: on a machine labelled `tools: docker`, each job of a project that has not turned it off gets a `docker` first on its `PATH` that adds `--label arthur.job=<id>` to what it creates (`run`, `create`, `build`, `buildx build`, `network create`, `volume create`), and `COMPOSE_PROJECT_NAME` from its id, so compose labels its stack itself. What a job creates past them (a library calling Docker's API, `docker` by its absolute path) is unlabelled and left to the sweep.

With the worktree: before a job's worktree is removed, on its machine, the job's containers are stopped and removed with their anonymous volumes, then its networks, its volumes and the images it built. Images it did not build (pulled bases, shared ones) are kept, and so is anything another job's container still uses. Then Docker's build cache, shared and never labelled per job, is cut to `buildCache`. A cleanup that fails (Docker not running, a timeout, a refusal) never keeps the worktree: the worktree is removed, the failure is a `notice`, and the sweep retries.

The floor: each machine's free disk, on the filesystems its jobs write (its home, and Docker's data root where Docker runs), is measured at every machine check. Under `keepFree.disk` no job starts there: the refusal names the machine, the path, the space and the floor (`build: no room, 12.3 GB free on /var/lib/docker, floor 20 GB`), and placement takes another machine with the labels. A machine that falls under the floor mid-job keeps its running jobs, which finish in the reserve the floor keeps; it emits `disk-low` once, and `docker` sweeps that machine at once.

The sweep: daily at `sweep.at`, and on `disk-low`, on every machine with Docker. It removes what is labelled with a job that no longer exists, at any age, and unlabelled leftovers older than `leftoverHours`: stopped containers, unused networks, dangling images, unused anonymous volumes, build cache unused that long. It never touches a running container, a named volume without Arthur's label, a tagged image no job built, or anything labelled `arthur.keep`. One `notice` per sweep tells the owner on the channels what it reclaimed on each machine, the free disk after, and what failed; a sweep that changed nothing says nothing, unless a machine stays under the floor.

Per project: `docker: false` in a project's `projects` entry turns the labels and the cleanup off for its jobs; the sweep is per machine and still runs.

Interface: `host.jobs.cleanup(fn)`, `host.jobs.prepare` returning variables for the job's environment, `host.jobs.run(machine, argv)` (a command on a machine, over SSH for another one), `collect("resources.disk")` (paths whose filesystem counts, such as Docker's data root), `disk-low`, `arthur docker`, `arthur docker sweep`.

## How it is built

- The plugin API is derived from three plugins: telegram, youtrack, schedule. They are a channel, a tracker and a timer; their common shape is the host API. The styleguide forbids abstracting before the second example, so the API is frozen after those three are built, not before.
- Channels (telegram, signal, discord, slack, whatsapp) share one interface: receive a message as typed `parts` (text, photo, video, voice, audio, file), send text, send media. A message may name its place (a Telegram topic, a Discord or Slack channel), and a send may name the place it goes to. A channel hands the parts to the core, which asks the plugins that claim them (`collect("message.part")`) to replace each by its text before the coordinator's turn. Each channel answers one allowed chat or number, or one Discord server or Slack workspace, and there only the owner's user. Every channel follows the coordinator's silent mode: `/silent` toggles it, and the coordinator turns it on by itself when the owner delegates work with a stop condition, and off when that work ends; while it is on, the owner hears only the end of that work, its stop condition met, a decision, and the answer to his own message, and quiet hours still send without a sound.
- Arthur is built by moving the predecessor's modules with their tests, not by rewriting them, feature by feature, in the order of `spec/roadmap.md`. Each ticket is neither a one-liner nor a whole plugin; each module and plugin is tested on its own, edge cases included. The predecessor takes only fixes until the switch. Arthur switches one project first, itself, then the others.
- The repository starts clean, with an empty board: the predecessor's history holds client names, paths and work, and is not published.

## Where the less obvious parts live

- The coordinator's conversation (compaction, the daily fresh start, the handoff between conversations, `/restart`, the restart guard, the start notice): `session`, first version.
- The worktree guard and its shell parser: core, beside the env guard, on for every job.
- Phone commands that need no model, and the command menu: the core's command registry; each plugin registers its own, channels route only.
- Night and time zone: core config `timeZone` and `quietHours`, read by every plugin.
- Planning of large tickets: part of `orchestration`; its own `planning` plugin only if orchestration outgrows its line budget.
- Which days the audit and the retro run: `manage` options `audit.days` and `retro.day` register the entries; `schedule` fires them.
- Finding a dead job, and the joint CPU and memory limit: the core's job runner.
- A project's own vision and criteria read by the roles: `projects` owns the paths (`prompts`); the core's prompt loader reads them.
- Docs per command and `--help`: part of the host API; a command registers with its doc file.
- The commit-subject rule and its hook: the `commit-rules` plugin, per project. Arthur's own repository uses it like any project.
- Language: English only from the first line of code; the board and every message read and write English keys.
- Ticket prefixes: `projects`, option `prefix` per project. No renumbering: the board starts empty.
- A project's Node version: `nvm`, from the project's `.nvmrc`, which onboarding adds.
- A job's state: the core's job runner (its record, `job-state`); shown by `orchestration` (context, wake, a notice when a job asks the user) and `/jobs` on every channel.
- The silent mode (`arthur silent`, `/silent`, its state, which reply and notice it holds): `orchestration`; every channel asks it before it sends a notice.
- Running a job on another machine: the core's job runner, over SSH. Which machines exist, their labels, and which one a job goes to: `machines`.
- A job's time and money: the core. A job's CPU and memory, a feature's caps, and how many jobs the free resources allow: `resources`.
- Free disk on a machine: `resources` (`keepFree.disk`). A job's Docker resources, the build cache cap and the leftover sweep: `docker`, through the core's cleanup hook on worktree removal.
- A project's own agent and the routing of its chat: `orchestration`; the place it answers in: the project's `chat` key in `projects`.

## Licence

Apache-2.0. Arthur is open source: anyone may use, change, fork and sell it under the Apache License 2.0. The name "Arthur" and the Arthur logo are reserved: they stay Kacper Adler's and are not licensed with the code (`NOTICE`). Contributions come under the same licence, each commit signed off under the Developer Certificate of Origin (`CONTRIBUTING.md`).

## Not the goal

- A hosted service, accounts, or a marketplace of third-party plugins. Plugins are packages the owner installs and lists in the config.
- Anything that listens on a public address: no webhooks, no public endpoint. The server plugin, when it comes, is reachable only over a private network.
- A mode without a coordinator, or a project list outside the config.
- Another agent runtime: Claude Code, Codex and others are not supported; OMP only.
- A plugin that changes the core's rules. A plugin adds, the core stays.
- Config in JSON or YAML, or a secret inside the config.
- A server and clients in the first version. The core emits the events for it; the server plugin is later.
- Features Arthur does not need for work in a real project.

## Decided (the owner, 2026-10-16)

1. Merge and review are a plugin, `delivery`, shipped in the first version. The core stays a job runner.
2. The plugin API is frozen after building three plugins (telegram, youtrack, schedule), not before.
3. One channel interface; a message may name its place (a topic or a channel), which a project's `chat` maps to its agent; WhatsApp last of the channels.
4. Server later. The first version polls GitHub. Arthur exposes nothing to the internet (no public port, no webhooks). The core emits events from day one.
5. The name is Arthur. `arthur.config.ts` and `.arthur/` are its files. Everything is English.
6. The env prefix is `ARTHUR_` (`ARTHUR_YOUTRACK_TOKEN`), with named instances as above.
7. The repository is `git@github.com:kacperadler/arthur.git`, public, open source under Apache-2.0; the name "Arthur" and its logo stay the owner's (the owner, 2026-10-19).
8. `schedule` is a module for actions and jobs at set times.
9. `session` is a plugin; its config covers compaction at 08, 13 and 18 and the fresh start at 23.
10. The coordinator is always there and talks with the user through a channel or the terminal; there is no single-agent mode. A project may have its own agent beside the coordinator (20).
11. Commit rules are their own plugin; the format is a regex, a plain-words rule, or a Markdown file, per project.
12. Arthur starts with an empty board; no history of the predecessor is carried over.
13. Projects live in `arthur.config.ts` (path, prefix, tracker instance, commit rules, other settings), not in a separate JSON file.
14. The coordinator is the `orchestration` plugin, required and impossible to disable, not part of the core: the core stays a job runner, and the coordinator is tested apart against a fake host.
15. The agent is OMP; the config is TypeScript naming env variables; diagrams are Mermaid.
16. Every job has one state: working, idle, blocked (on the user or a dependency), or ended; the coordinator and the channels show it.
17. Arthur runs on one machine and starts jobs on others it reaches over SSH on a private network (Tailscale), placed by the labels (os, arch, tools) a project or a ticket requires. Nothing is exposed to the internet.
18. A `resources` plugin caps what one job or one feature may use (CPU, memory, time, money; a job's time and money are the core's existing limits) and decides how many jobs start from each machine's free resources; `maxAgents` stays the upper bound.
19. Arthur watches disk space and cleans Docker with each worktree, so agents never stop for a full disk: free disk is a resource of `resources`, a job's Docker resources are labelled and removed with its worktree by a `docker` plugin, and a daily sweep reclaims leftovers.
20. (the owner, 2026-10-17) The coordinator stays, and a project with a `chat` gets its own agent, which talks with the owner in that project's chat (a Telegram topic, a Discord channel, a Slack channel) and works only on that project; the coordinator keeps `maxAgents`, the morning report and the work across projects. Later, for companies, the coordinator directs like a CEO and each project's agent leads like a department head; agents above projects may be added then, and none is built now. Slack is a channel, later, after signal and before WhatsApp; Discord moved to the first version (21). Teams is not for now.
21. (the owner, 2026-10-18) Discord is the first-version channel the owner uses; Telegram stays in the first version as an option, and each channel is a plugin the config turns on. One private Discord server: a main channel for the coordinator and one channel per project, ready before the project agents use them. The bot answers only the owner's user id, on that one server; the server requires 2FA; the bot token lives only in the environment; the bot asks for the least gateway intents and permissions; no secret is pasted in a channel. The gateway is Node's built-in `WebSocket`, not discord.js, so there is still no runtime dependency. Later, the owner's own apps, a mobile app (Expo) and the web panel, reach the server plugin by the VPS's Tailscale name, with no public port.
