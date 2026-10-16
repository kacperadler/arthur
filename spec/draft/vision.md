# Arthur: one core, many plugins

> Draft of 2026-10-16 (K0253). The coordinator wrote it from the human's ideas and decisions of that day; the human owns it. The name is Arthur (the human, 2026-10-16). "The harness" below means the one that runs today, in this repository. Diagrams: `core-and-plugins.mmd`, `config-flow.mmd`, `versions.mmd`. Example config: `arthur.config.ts`. The inventory of what the harness does today, and where each part goes, is `spec/next/inventory.md` on the branch `h/2026-10-16-k0254-harness-inventory-96acf65b` (K0254). No code exists yet.

## Purpose

A small core that runs agent jobs in isolated Git worktrees and keeps the ticket board, and plugins that switch on everything else from one config file. One human directs many agents through one coordinator, who does not read code: the human creates the work, says when it is done, keeps each project's vision.

The core itself does no orchestration. The coordinator is the `orchestration` plugin, and it is always loaded: Arthur refuses to start without it, and `enabled: false` on it is refused. Everything else is a plugin the owner turns on, with its own options.

Arthur is the harness that runs here today, cut along that boundary.

## What stays true

- One human directs many agents; the human creates the work, decides when it is done, keeps each project's vision. The current vision's rules about approval and merge move with it, as options of the orchestration and delivery plugins, not as core code.
- The coordinator is always on, and it is the one that talks with the user: through a channel plugin (Telegram first) or through the terminal, where the human attaches to the coordinator's own session (`arthur attach`). Several channels may be on at once; none is required, since the terminal is always there. There is no mode without a coordinator.
- Work happens in isolated worktrees, on their own branches.
- Plain files in git and in the home folder (`.arthur/`) are the truth: tickets, the board, job records. No database.
- Arthur starts with an empty board. This repository's `spec/` history (tickets, outcomes, reviews, reports) stays here; nothing is carried over.
- Projects are declared in `arthur.config.ts`, and nowhere else: each one's path or repository, ticket prefix, tracker instance, commit rules and other settings are options of the `projects` plugin. There is no separate JSON file for them. Adding a project is an edit of the config, reviewed like code.
- The agent is OMP (the human, 2026-10-16). The core runs `omp`; there is no agent-adapter layer.
- Arthur is English only: code, docs, and everything it says to the user (channel messages, reports, prompts). The human may write in any language; Arthur answers in English.
- Arthur exposes nothing to the internet (the human, 2026-10-16): no public endpoint, no webhook receiver, no public port. Every plugin calls out (Telegram and GitHub are polled) or talks to a local process.
- One config file, `arthur.config.ts`: the plugin list, each plugin with its options. It holds no secret: an option ending in `Env` names the environment variable that holds it. The values stay in the shell or `.env`, which is never committed. Variables are `ARTHUR_<PLUGIN>_<WHAT>`, e.g. `ARTHUR_YOUTRACK_TOKEN`. A plugin with several accounts (YouTrack servers, Telegram bots, GitHub accounts) lists named instances, each with its own variables, `ARTHUR_<PLUGIN>_<INSTANCE>_<WHAT>`, e.g. `ARTHUR_YOUTRACK_ACME_TOKEN`; one instance may omit its name and use the short form. A project names its instance.
- Core and each plugin are tested apart: the core against a fake plugin and a fake agent, a plugin against a fake host. A plugin never imports another plugin; it talks to the core and, through it, to others.
- It runs on a VPS as a process, as now. Running it needs Node and OMP, no runtime dependencies.
- It stays small enough for one person to understand from its map: the core's line budget is set in the new repository and each plugin has its own.
- The repository is public, on GitHub: `git@github.com:kacperadler/arthur.git`.

## The coordinator and its options

The `orchestration` plugin is the coordinator. It directs every project in the `projects` list, and its limits count across all of them. What remains configurable:

| Option | Does |
| --- | --- |
| `maxAgents` | The most jobs running at once, across all projects together (3 today, hard-coded in `src/hand-back.ts`). |
| `coordinator`, `roles` | Model and thinking level of the coordinator and of each role (worker, reviewer, planner, auditor, retro, onboarding), and the quick model. |
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
| Terminal | `arthur attach` opens the coordinator's session; the same commands run from a shell. |
| Job runner | One job in one worktree on one branch: spawn `omp`, its log, limits (time, budget, CPU and memory in one joint slice), stop, continue, steer. Finds a job whose process is gone and fails it. |
| Ticket board | Tickets as files, the board as one JSON, changed only through the core's own command. Ids are the project's `prefix` and a number, from 1. |
| Prompt loader | Builds each role's prompt: the role file a plugin ships, a project's own override, then the project's criteria files. |
| Event stream | Every state change (job started, ended, ticket moved) is an event from day one, so a server plugin can come later without changing the core. |
| Clock | `timeZone` and `quietHours`, read by every plugin through the host: schedule, session, channels, orchestration. |
| Env guard | Keeps a job's agent from reading the env file (`.env`), so a secret stays with the process that needs it. |
| Worktree guard | In every job, refuses a write into the main checkout, the home folder or another job's worktree. |

Plugins. First = in the first version, later = after it. Named = the human named it on 2026-10-16; derived = added because today's harness already does it.

| Plugin | First or later | Does | Comes from today |
| --- | --- | --- | --- |
| orchestration (named) | first, always on | The coordinator: the options above, wake on job end, the planning of large tickets. | `bin/h-coordinator`, `hook/wake.ts`, `hook/context.ts`, `H_MODEL_*`, `H_THINKING_*`, `src/autopilot.ts`, `src/plan.ts` |
| session (named) | first | The coordinator's conversation: compaction at 08:00, 13:00 and 18:00, a fresh start at 23:00, `/restart` and `/restart fresh`, the restart guard, the start notice and LLM probe. | `bin/h-coordinator`, `hook/compact.ts`, `src/restart-due.ts`, `src/llm-probe.ts`, the `deploy/` timers |
| schedule (named) | first | A module for actions and jobs at set times: an entry is a daily time or a one-off date and time, and does an action (a message to the coordinator, optionally a named procedure) or a job (spawn one of a kind). Other plugins register their own entries from their options; hand-added ones live in a file. | `src/schedule.ts`, `hook/schedule.ts`, `spec/schedule.json` |
| projects (named) | first | The project list, declared in the config: path or repo, ticket prefix, tracker instance, commit rules, auto-merge, CI workflow, vision and criteria paths, folders in front of `PATH`. Onboarding of a new repository. | `spec/clients.json`, `.agents/harness/project.json`, `.h/repos`, `src/repos.ts`, `src/commands/init.ts` |
| commit-rules (named) | first | Each project's commit format, set by a regex, a plain-words rule, or a path to a Markdown file that describes it. Below. | `.githooks/commit-msg` |
| youtrack (named) | first | One entry per server; reads and writes issues, comments, articles, work items. | `src/integrations/youtrack` |
| telegram (named) | first | A channel: receive, send text, send media. | 7 `src/telegram-*.ts`, `hook/telegram.ts` |
| delivery (derived) | first | Review, always-review list, merge after PASS and green CI, the changelog. | `src/review*.ts`, `src/commands/merge.ts`, `src/hand-back.ts` |
| github (derived) | first | Polls CI runs and pull requests, wakes the coordinator. | `src/commands/ci.ts`, K0252 |
| manage (named: managing Arthur) | first | The audit, the retro, health, prune, stats. Its options (`audit.days`, `retro.day`) make the schedule entries, not prose in one. | `h health`, `h prune`, `h stats`, `h retro-due`, the audit and retro procedures |
| develop (named: developing Arthur) | first | The test kit (fake agent, fake host), a command that creates a plugin, evals. | `test/fake-omp.ts`, `test/fake-hooks.ts`, `h eval` |
| signal (named) | later | A channel, through signal-cli. | none |
| whatsapp (named) | later | A channel, through a local bridge. The official Business API is out: it delivers incoming messages by webhook. | none |
| server (named) | later | The core's events and commands over HTTP and a stream, for clients (a phone app, a web page, a T3 Code-like UI). Bound to a private network, with a token. | none |

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

Arthur polls, as K0252 does: the github plugin asks for the CI runs of the branches in play every `poll.everySeconds` (120 in the example) and emits `ci-finished` once per run, keyed by run id; the coordinator wakes on it. A project names the workflow to watch in its `ci` option. The cost is the interval's delay before the coordinator learns a run ended. Nothing listens for GitHub, so there is no secret to check and nothing to expose. Webhooks were dropped from the plan on 2026-10-16; if they return, they come back as a decision of the human, with the exposure explained first.

## How it is built

- The plugin API is derived from three plugins that exist: telegram, youtrack, schedule. They are a channel, a tracker and a timer; their common shape is the host API. The styleguide forbids abstracting before the second example, so the API is written after moving those three, not before.
- Channels (telegram, whatsapp, signal) share one interface: receive text, send text, send media. Each channel answers one allowed chat or number.
- The project is built by moving code out of this repository, not rewriting it: each module moves with its tests. Today's harness takes only fixes until the switch. The new repository is worked on as a project of today's harness (`h init <path>`), under the same reviews. Switch one project first, the harness itself (it becomes Arthur's own project), then the clients.
- The new repository starts clean: this repository's history holds client names, paths and work, and cannot be published. Its board starts empty.

## Gaps from the inventory, and their homes

K0254 mapped everything the harness does to Arthur and found thirteen capabilities the first plan had no home for. Each has one now:

| Gap | Capability | Home |
| --- | --- | --- |
| G1 | Session lifecycle: compaction, the daily fresh start, `/restart`, the restart guard, the start notice | The `session` plugin, first version. Options in `arthur.config.ts`. |
| G2 | Worktree guard and its shell parser | Core, beside the env guard, on for every job. |
| G3 | Phone commands that need no model, and the command menu | The core's command registry; each plugin registers its own, channels route only. |
| G4 | Night and time zone: quiet hours, Warsaw time in timers and schedule | Core config `timeZone` and `quietHours`, read by every plugin. |
| G5 | Planning of large tickets | Part of `orchestration`; its own `planning` plugin only if orchestration outgrows its line budget. |
| G6 | Which day the audit and the retro run (prose in schedule entries today) | `manage` options `audit.days` and `retro.day` register the entries; `schedule` fires them. |
| G7 | Finding a dead job; the joint CPU and memory limit | Core job runner. |
| G8 | A project's own vision and criteria read by the roles | `projects` owns the paths (`prompts`); the core's prompt loader reads them. |
| G9 | Docs per command, `--help` | Part of the host API: a command registers with its doc file. |
| G10 | The commit-subject rule and `.githooks` | The `commit-rules` plugin, per project (above). |
| G11 | Language: the Polish final message and retro headings, and the Polish keys code reads (`dalej:`, `- Plan: tak`) | English only from the first line of code: the board reads English keys. No old ticket is rewritten, since the board starts empty. Each plugin writes the roles it ships in English. |
| G12 | The history of tickets, outcomes, reviews and reports in `spec/` | Stays in this repository; Arthur starts empty (decided). |
| G13 | Per-repository ticket prefixes and `h init --renumber` | `projects`, option `prefix` per project. No renumbering: the board starts empty. |

## Licence

FSL-1.1-ALv2, the Functional Source License with Apache 2.0 after two years, like kentcdodds/kody (the human, 2026-10-16). It is source-available, not open source by the OSI definition. Anyone may read, run, change and fork it, but not sell it as a competing product during the two years; each release becomes Apache-2.0 two years after it. The README says this plainly and does not call the project "open source".

## Not the goal

- A hosted service, accounts, or a marketplace of third-party plugins. Plugins are packages the owner installs and lists in the config.
- Anything that listens on a public address: no webhooks, no public endpoint. The server plugin, when it comes, is reachable only over a private network.
- A mode without a coordinator, or a project list outside the config.
- Another agent runtime: Claude Code, Codex and others are not supported; OMP only.
- A plugin that changes the core's rules. A plugin adds, the core stays.
- Config in JSON or YAML, or a secret inside the config.
- A server and clients in the first version. The core emits the events for it; the server plugin is later.
- Features Arthur does not need for work in a real project.

## Decided (the human, 2026-10-16)

Decided: stay on OMP; TypeScript config with env names; the licence; Mermaid diagrams; the folder; and:

1. Merge and review are a plugin, `delivery`, shipped in the first version. The core stays a job runner.
2. The plugin API is written after moving three plugins (telegram, youtrack, schedule), not before.
3. One channel interface; WhatsApp last of the channels.
4. Server later. The first version polls GitHub, as K0252 does. Webhooks are removed from the plan; Arthur exposes nothing to the internet (no public port). The core emits events from day one.
5. The name is Arthur. `arthur.config.ts` and `.arthur/` are confirmed. Everything is English.
6. The env prefix is `ARTHUR_` (`ARTHUR_YOUTRACK_TOKEN`), with named instances as above.
7. The repository is `git@github.com:kacperadler/arthur.git`, public.
8. `schedule` is a module for actions and jobs at set times.
9. `session` is a plugin; its config covers compaction at 08, 13 and 18 and the fresh start at 23, as today.
10. The coordinator is always there and talks with the user through a channel or the terminal; there is no single-agent mode.
11. Commit rules are their own plugin; the format is a regex, a plain-words rule, or a Markdown file, per project.
12. Arthur starts with an empty board; this repository's `spec/` history stays here.
13. Projects live in `arthur.config.ts` (path, prefix, tracker instance, commit rules, other settings), not in a separate JSON file.

## Open questions for the human

1. The coordinator is always on. Proposed: it is still the `orchestration` plugin, required and impossible to disable, so the core stays a job runner and the plugin is tested apart. The alternative is to build the coordinator into the core. Which?

## One line for this repository's vision, until the switch

Proposed for `spec/vision.md` (the human owns that file; this job did not edit it): "Until the new project replaces it, this harness serves work in real projects and takes only fixes; its successor, one core and plugins, is planned in `spec/next/` and built as a project of this harness."
