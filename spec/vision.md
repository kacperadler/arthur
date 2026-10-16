# Arthur: one core, many plugins

Arthur is a small core that runs agent jobs in isolated Git worktrees and keeps the ticket board, and plugins that switch on everything else from one config file. It rebuilds, as a public project, the harness its owner runs today, cut along that boundary. Diagrams: `docs/architecture/core-and-plugins.mmd`, `docs/architecture/config-flow.mmd`, `docs/architecture/versions.mmd`. Example config: `arthur.config.example.ts`. The order of the work: `spec/roadmap.md`.

## Purpose

One human directs many agents through one coordinator, who does not read code: the human creates the work, says when it is done, keeps each project's vision.

The core itself does no orchestration. The coordinator is the `orchestration` plugin, and it is always loaded: Arthur refuses to start without it, and `enabled: false` on it is refused. Everything else is a plugin the owner turns on, with its own options.

## What stays true

- One human directs many agents; the human creates the work, decides when it is done, keeps each project's vision. The rules about approval and merge are options of the `orchestration` and `delivery` plugins, not core code.
- The coordinator is always on, and it is the one that talks with the user: through a channel plugin (Telegram first) or through the terminal, where the human attaches to the coordinator's own session (`arthur attach`). Several channels may be on at once; none is required, since the terminal is always there. There is no mode without a coordinator.
- Work happens in isolated worktrees, on their own branches.
- Plain files in git and in the home folder (`.arthur/`) are the truth: tickets, the board, job records. No database.
- Arthur starts with an empty board. Nothing of the predecessor's tickets, outcomes, reviews or reports is carried over.
- Projects are declared in `arthur.config.ts`, and nowhere else: each one's path or repository, ticket prefix, tracker instance, commit rules and other settings are options of the `projects` plugin. There is no separate JSON file for them. Adding a project is an edit of the config, reviewed like code.
- The agent is OMP. The core runs `omp`; there is no agent-adapter layer.
- Arthur is English only: code, docs, and everything it says to the user (channel messages, reports, prompts). The human may write in any language; Arthur answers in English.
- Arthur exposes nothing to the internet: no public endpoint, no webhook receiver, no public port. Every plugin calls out (Telegram and GitHub are polled) or talks to a local process.
- One config file, `arthur.config.ts`: the plugin list, each plugin with its options. It holds no secret: an option ending in `Env` names the environment variable that holds it. The values stay in the shell or `.env`, which is never committed. Variables are `ARTHUR_<PLUGIN>_<WHAT>`, e.g. `ARTHUR_YOUTRACK_TOKEN`. A plugin with several accounts (YouTrack servers, Telegram bots, GitHub accounts) lists named instances, each with its own variables, `ARTHUR_<PLUGIN>_<INSTANCE>_<WHAT>`, e.g. `ARTHUR_YOUTRACK_ACME_TOKEN`; one instance may omit its name and use the short form. A project names its instance.
- Core and each plugin are tested apart: the core against a fake plugin and a fake agent, a plugin against a fake host. A plugin never imports another plugin or the core's internals, only the core's published interface; it talks to the core and, through it, to others.
- It runs on a VPS as a process. Running it needs Node and OMP, no runtime dependencies.
- It stays small enough for one person to understand from its map: the core has a line budget, and each plugin has its own.
- The repository is public, on GitHub: `git@github.com:kacperadler/arthur.git`.

## The coordinator and its options

The `orchestration` plugin is the coordinator: one interactive `omp` in its own tmux session, started again whenever it ends. It directs every project in the `projects` list, and its limits count across all of them. What remains configurable:

| Option | Does |
| --- | --- |
| `maxAgents` | The most jobs running at once, across all projects together. Enforced, not only a rule in the prompt. |
| `coordinator`, `roles` | Model and thinking level of the coordinator and of each role (worker, reviewer, planner, auditor, retro, onboarding), and the quick model; the coordinator's tmux session and restart timing. |
| `plan` | The budget of a plan for a large ticket (planner role, plan review). |
| `autopilot` | The budget of a pre-approved job and its cap. |
| `morningReport` | When the morning report is sent; registers a schedule entry. |

The core keeps what is not a decision about directing: the limits of one job (time, budget) and of all jobs together (CPU, memory).

## Core and plugins

The core, always on:

| Part | Does |
| --- | --- |
| Config loader | Loads `arthur.config.ts`, checks every plugin's options, resolves the `...Env` names against the environment. Refuses to start on a missing required variable, a missing plugin dependency (including `orchestration`), an unknown option. |
| Plugin host | Calls each enabled plugin with the host API; a plugin subscribes to events, emits events, reads its options and env, and reads the project list. A disabled plugin is not loaded. |
| Command registry | A plugin registers its commands, each with its doc page (what `arthur <cmd> --help` prints) and, where it has one, a phone command (`/jobs`, `/health`, `/restart`). A channel only routes `/name text` to the host and sends the reply; it imports no other plugin. |
| Terminal | Every registered command runs from a shell as `arthur <cmd>`; `arthur attach`, which `orchestration` registers, opens the coordinator's session. |
| Job runner | One job in one worktree on one branch: spawn `omp`, its log, limits (time, budget, CPU and memory in one joint slice), stop, continue, steer. Finds a job whose process is gone and fails it. A plugin registers the kinds of job it owns (review, audit, plan, ...). |
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
| orchestration (named) | first, always on | The coordinator: its session process and `arthur attach`, the options above, wake on job end, the planning of large tickets, autopilot. |
| session (named) | first | The coordinator's conversation: compaction at 08:00, 13:00 and 18:00, a fresh start at 23:00, `/restart` and `/restart fresh`, the restart guard, the start notice and LLM probe. |
| schedule (named) | first | A module for actions and jobs at set times: an entry is a daily time or a one-off date and time, and does an action (a message to the coordinator, optionally a named procedure) or a job (spawn one of a kind). Other plugins register their own entries from their options; hand-added ones live in a file. |
| projects (named) | first | The project list, declared in the config: path or repo, ticket prefix, tracker instance, commit rules, auto-merge, CI workflow, vision and criteria paths, folders in front of `PATH`. Onboarding of a new repository. |
| commit-rules (named) | first | Each project's commit format, set by a regex, a plain-words rule, or a path to a Markdown file that describes it. Below. |
| youtrack (named) | first | One entry per server; reads and writes issues, comments, articles, work items. |
| telegram (named) | first | A channel: receive, send text, send media. |
| delivery (derived) | first | Review, always-review list, merge after PASS and green CI, the changelog. |
| github (derived) | first | Polls CI runs and pull requests, wakes the coordinator. |
| manage (named: managing Arthur) | first | The audit, the retro, health, prune, stats. Its options (`audit.days`, `retro.day`) make the schedule entries, not prose in one. |
| develop (named: developing Arthur) | first | A command that creates a plugin, evals of the coordinator's turns. |
| signal (named) | later | A channel, through signal-cli. |
| whatsapp (named) | later | A channel, through a local bridge. The official Business API is out: it delivers incoming messages by webhook. |
| server (named) | later | The core's events and commands over HTTP and a stream, for clients (a phone app, a web page, a T3 Code-like UI). Bound to a private network, with a token. |

Order of the later plugins, cheapest first: signal (a local process), then whatsapp (an unofficial bridge: the account may be banned), then server (needs a stable event protocol and auth).

## Commit rules

Each project sets one rule in its `projects` entry, `commitRules`, in one of three forms:

| Form | Example | How it is enforced |
| --- | --- | --- |
| `regex` | `^(feat\|fix\|docs)(\(.+\))?!?: .{1,72}$` | A `commit-msg` git hook in the project's worktrees refuses a subject that does not match, and says the rule. |
| `words` | `Start with the ticket id, then a verb in the imperative.` | Given to the worker and the reviewer in their prompts; the review judges it. A model cannot refuse a commit as a hook does, so a miss is a review finding, not a refusal. |
| `file` | `docs/commit-rules.md` | The Markdown file is read as `words`, from the project's own repository, so the rule is versioned with it. |

A project with no `commitRules` has none. The plugin never edits a project's own git configuration outside Arthur's worktrees.

## GitHub without webhooks

Arthur polls: the github plugin asks for the CI runs of the branches in play every `poll.everySeconds` (120 in the example) and emits `ci-finished` once per run, keyed by run id; the coordinator wakes on it. A project names the workflow to watch in its `ci` option. The cost is the interval's delay before the coordinator learns a run ended. Nothing listens for GitHub, so there is no secret to check and nothing to expose. If webhooks ever return, they come back as a decision of the owner, with the exposure explained first.

## How it is built

- The plugin API is derived from three plugins: telegram, youtrack, schedule. They are a channel, a tracker and a timer; their common shape is the host API. The styleguide forbids abstracting before the second example, so the API is frozen after those three are built, not before.
- Channels (telegram, whatsapp, signal) share one interface: receive text, send text, send media. Each channel answers one allowed chat or number.
- Arthur is built by moving the predecessor's modules with their tests, not by rewriting them, feature by feature, in the order of `spec/roadmap.md`. Each ticket is neither a one-liner nor a whole plugin; each module and plugin is tested on its own, edge cases included. The predecessor takes only fixes until the switch. Arthur switches one project first, itself, then the others.
- The repository starts clean, with an empty board: the predecessor's history holds client names, paths and work, and is not published.

## Where the less obvious parts live

- The coordinator's conversation (compaction, the daily fresh start, `/restart`, the restart guard, the start notice): `session`, first version.
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

## Licence

FSL-1.1-ALv2, the Functional Source License with Apache 2.0 after two years. It is source-available, not open source by the OSI definition. Anyone may read, run, change and fork it, but not sell it as a competing product during the two years; each release becomes Apache-2.0 two years after it. The README says this plainly and does not call the project "open source".

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
3. One channel interface; WhatsApp last of the channels.
4. Server later. The first version polls GitHub. Arthur exposes nothing to the internet (no public port, no webhooks). The core emits events from day one.
5. The name is Arthur. `arthur.config.ts` and `.arthur/` are its files. Everything is English.
6. The env prefix is `ARTHUR_` (`ARTHUR_YOUTRACK_TOKEN`), with named instances as above.
7. The repository is `git@github.com:kacperadler/arthur.git`, public, under FSL-1.1-ALv2.
8. `schedule` is a module for actions and jobs at set times.
9. `session` is a plugin; its config covers compaction at 08, 13 and 18 and the fresh start at 23.
10. The coordinator is always there and talks with the user through a channel or the terminal; there is no single-agent mode.
11. Commit rules are their own plugin; the format is a regex, a plain-words rule, or a Markdown file, per project.
12. Arthur starts with an empty board; no history of the predecessor is carried over.
13. Projects live in `arthur.config.ts` (path, prefix, tracker instance, commit rules, other settings), not in a separate JSON file.
14. The coordinator is the `orchestration` plugin, required and impossible to disable, not part of the core: the core stays a job runner, and the coordinator is tested apart against a fake host.
15. The agent is OMP; the config is TypeScript naming env variables; diagrams are Mermaid.
