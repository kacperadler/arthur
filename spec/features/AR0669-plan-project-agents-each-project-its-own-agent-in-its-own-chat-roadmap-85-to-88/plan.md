# AR0669 - Plan

- Job: 2026-11-13-plan-b2fe226d
- Planned at: 91022926a5f6866f2162a4f6dfb613d0ecb9e269

## Approach

The plan follows the recommended option under Not available directly: a small core change so every `arthur` command in a project agent's session defaults to that project.

What changes. In `projects/<name>/project.config.ts`, a project with `orchestration.project({ chat: { plugin, instance?, place } })` gets its own interactive `omp`. It runs beside the coordinator, supervised the same way (`supervise` in `packages/orchestration/src/coordinator.ts`). It talks only in that chat and directs only that project's jobs. A project without `chat` changes nothing.

The coordinator keeps:
- `maxAgents`;
- the morning report;
- messages that name no project (schedule, the main chat);
- the work across projects, which reaches a project agent only through `arthur agent tell`.

Each agent reuses what the coordinator already has; nothing is rewritten:
- Its own folder `<home>/orchestration/agents/<project>/`, with the same inbox and outbox files, pid file, stop mark, fresh mark and `mcp/`. `inbox-extension.ts`, `context-extension.ts`, `hand-over.ts` and the session extensions already act only on the folder their variable names.
- Its own tmux session on the coordinator's socket, named `<coordinator session>-<project>`, with `.` turned into `_` because tmux reads `.` in a target.
- `--session-dir <agent folder>/sessions`, so `--continue` never resumes the coordinator's conversation.

Four follow-up tickets, merged in this order, each `arthur ticket after` the one before.

**T1, roadmap 85: processes and `arthur attach <project>`**
- **The piece.** `orchestration.project` and the plugin's `piece` check the shape. Two projects with the same `plugin`+`instance`+`place` are refused at setup, naming both projects.
- **One file for the list of sessions.** `sessions.ts` holds the coordinator plus one entry per project with a `chat`, and finds which session a process runs in from `ARTHUR_ORCHESTRATION_FOLDER`.
- **Supervising.** `supervise` takes a session: its tmux name, folder, its context command (`coordinator context <project>`), extra flags (`--session-dir`) and variables:
  - `ARTHUR_ORCHESTRATION_SESSION=agent:<project>`, which the stats extension reads for its file name;
  - `ARTHUR_PROJECT=<project>` (Not available directly).
- **Starts and crashes.** Starts go one at a time through a promise chain shared by all supervisors in `arthur run`. Each agent has its own pid file and stop mark, so one crashing in a loop touches no other.
- **Role and model.** The role file is `roles/project.md`, role name `project`, matching the existing `roles.project` and `mcp.roles.project` keys (roadmap 85 says `project-agent.md`; the roadmap entry is updated). `roles.project.model` must be one name, as `coordinator.model` is; a list is refused at check. MCP comes from `mcpServers(..., "project")`.
- **Extensions.** `collectEach("coordinator.extension", { session })` is asked once per session. An `undefined` answer is now skipped without a log line. Until T4, the session plugin answers only for the coordinator.
- **Commands.** `arthur attach [<project>]`, `arthur coordinator stop [<project>]` (refused while a job of that project runs) and `arthur coordinator context [<project>]`. These move out of `orchestration.ts` (172 lines) into a new `coordinator-commands.ts`. In T1 the agent's context is its role plus `## Time`; T3 fills in the rest.
- **Who acts.** `actor` answers `agent:<project>` in an agent's session.
- **Spawn guard.** `beforeSpawn` refuses, from an agent's session, a spawn or continue of another project.
- **Doctor checks.**
  - Critical (refuses `arthur run`'s start): "chat's plugin provides `channel.send`".
  - Telegram: one line per bot some chat names, `getMe.has_topics_enabled`. Telegram reads the chats through `orchestration.chats`, never orchestration's piece.
- **Docs.** The doc page says each agent takes about 0.7 GB outside the jobs' slice, so `jobs.memory` should go down for each agent added.

**T2, roadmap 86: routing, wake, `arthur agent tell`**
- **Where messages go.** A `message-received` whose `channel`+`instance`+`place` a chat names goes to that agent's inbox; anything else goes to the coordinator. `received/` stays one queue in the coordinator's folder, so the order holds. A message already seen in any session's boxes is not queued again.
- **Wakes and plugin messages.** `job-ended` goes to the agent of the job's project, else the coordinator. So does a `coordinator-message` whose data names `project`. Delivery, github, uptime and `decision-hooks.ts` add `project` to the messages they already word per project.
- **Replies and notices.**
  - A project agent's `coordinator-replied` carries its chat's `place` and `instance`, and `channels: [chat.plugin]`. Silent's hold still reads only the owner channels its turn answered.
  - Its blocked-job notice and "Recorded as your decision" notice carry `channel`+`instance`+`place`.
  - Telegram and Discord pick the bot by `instance` when no answered message names one. A notice for another channel's place is sent at their main place.
  - The voice note follows the reply's place.
- **Agent removed from config.** At start, messages left in the inbox of a removed agent move to the coordinator's queue, so none is lost.
- **`arthur agent tell <project|coordinator> '<text>'`.** It emits `agent-told`, which every process queues into the target's inbox, marked `[from coordinator]` or `[from agent:<p>]`; the inbox already writes on every process that gets the event. It is refused outside a session, to itself, and to an unknown agent, naming those that exist.
- **Roles.** The coordinator's role sends work for a project with an agent through `tell`.
- **Splits.** `inbox.ts` is at 200 lines, so `wake()` and `turn()` move to a new `wake.ts`.

**T3, roadmap 87: context**
- `coordinatorContext(host, { project })` with one project:
  - its role (`prompt("project", name)`), override, criteria and personality;
  - its vision, with a warning line when it is missing;
  - its board;
  - its jobs not ended;
  - its open decisions (`decisionContext` gets a project filter);
  - `Slots: <n> of <maxAgents> in use, every project counted`;
  - `## Time`;
  - the plugins' lines, unchanged.
- The coordinator's context gets one line per agent: `up since` from its pid file's start time, or `down since` from a `down` mark the supervisor writes.

**T4, roadmap 88: session for every session**
- Orchestration provides `orchestration.sessions` (name, project, chat, folder).
- The session plugin gives each project agent `<home>/session/agents/<project>/` as its `ARTHUR_SESSION_FOLDER`. Handoff, request, `agent`, `context-use`, `turn-failed/` and `restarted.json` work per folder unchanged; the coordinator keeps `<home>/session/`.
- **Compaction.** At a slot, one session at a time: the next is asked only once no compact request is open in any session.
- **Fresh start.** The coordinator's waits for every job and merge, as now. An agent's waits only for its project's jobs and merges.
- **`/restart`.** It restarts the session of the chat in `PhoneFrom`. `coordinator.restart` takes an optional `project`.
- **Notices.** Start notice, probe (with `roles.project`'s model), `Restarted.` and turn-failed notices go to each session's chat.
- **What stays.** The restart guard keeps its rule: a restart of `arthur run` stops every supervisor, so every session restarts. The morning report stays with the coordinator.
- **Split.** `restart.ts` is at 216 lines, so `registerRestart` moves to a new `restart-command.ts`.

**What a project agent may do, compared with the coordinator**
- **Spawns.** Only its project's jobs; refused by orchestration for another project. Every spawn counts against `maxAgents` across all projects, as `spawn-rules.ts` already counts; nothing is reserved per project.
- **Approvals, merges, `--budget 0`, take-main, class approvals.** The same `decision.owner` rules apply, but only with a decision id of its own project. `projectOf` refuses another project's id from an agent's session, so `answer`, `close` and every use are covered. `--autopilot` likewise, only for its own tickets.
- **Decision log.** Its project's `spec/decisions.jsonl` only, committed with its board.
- **Coordinator only.** The morning report, `arthur stopall`, `coordinator stop`, Dokploy and other writes across projects. These are role rules, plus the `--project` default.

**How the owner's decisions stay his in a project chat**
- `proof()` reads the inbox of the session the command runs in. An agent records an answer only from the owner's own `[via <channel>]` messages in its chat. The coordinator records one only from the main chat.
- A `[from …]` message (`tell`), like a forward or the terminal, never proves an answer: `proof` requires `channel`.
- Every rule of `decision-use.ts` applies unchanged: his message, option 1, the id named, no grant or policy.
- The "Recorded as your decision" notice goes to the chat the answer came from.

**What stays as it is:** the job runner, the board, the morning report, schedule's actions, `coordinator.checkoutContext` and the evals, the restart guard's rule, herdr (still one `coordinator` tab), and silent mode's single switch (Open questions).

**Line budgets.** Estimates, counted as `test/structure.ts` counts. Each raise shows in its merge's outcome.md.

| Ticket | Package | Used / budget now | Added |
|---|---|---|---|
| T1 | orchestration | 2917/2918 | +130 |
| T1 | telegram | 682/682 | +15 |
| T1 | session | 960/960 | +2 |
| T1 | stats | 575/575 | +0 (one line edited) |
| T1 | core | 7606/7607 | +0 (`cli.ts:25` edited) |
| T2 | orchestration | | +110 |
| T2 | telegram, discord (977/977) | | +3 each |
| T2 | delivery, github, uptime | | +0 to +2 each |
| T3 | orchestration | | +45 |
| T4 | session | | +90 (to about 1050) |
| T4 | orchestration | | +12 |

Orchestration ends at about 3215.

## Not available directly
- **A default project per session.** Commands act on the main project unless `--project` is given (`packages/core/src/cli.ts:23-25`; `CommandInput.project` in `commands.ts`, "undefined means the main one"). Without a default, a project agent's `arthur ticket new` or `decision ask` lands on the main project's board: Arthur's public repository, which may name no client.
  - Option 1: role rule plus orchestration guards on spawn and decisions - cost 0 core lines, risk: `ticket new` and `decision ask` without `--project` still land on Arthur's public board.
  - Option 2: `cli.ts` reads `ARTHUR_PROJECT` as the `--project` default, which `supervise` sets for each agent - cost one edited line plus a test and the doc line, risk: a job started from the agent inherits it and defaults to that project, which is the same project [INFERENCE: the wrapper's environment was not traced].
  - Option 3: an `arthur` script first on the agent's PATH that adds `--project` - cost one file per agent, risk: it shadows the real binary and breaks commands that take positional arguments.
  - Recommendation: Option 2, together with Option 1's guards.
- **"Refused at load: a chat whose plugin provides no channel.send" (roadmap 85).** A `piece` check sees only its value and its own options (`packages/core/src/plugin.ts:51-54`). Providers exist only after their plugin's setup, and the Host API has no call that says who provides a name without calling it (`plugin.ts`, `Host`).
  - Option 1: a critical `arthur doctor` line, which already refuses `arthur run`'s start before any plugin starts. It probes `collectEach("channel.send", { files: [] })`, which Telegram and Discord refuse before sending anything (`outgoing` in each `media-out.ts`) - cost about 10 lines, risk: a future channel that sends on an empty list.
  - Option 2: a core `host.provides(name)` - cost a change to the frozen plugin API (a recorded decision), about 5 lines plus docs, risk: low.
  - Option 3: orchestration lists every known channel in `after` - cost a list of plugin names, risk: a new channel is silently unchecked.
  - Recommendation: Option 1.

## Files
- `packages/orchestration/src/sessions.ts` (new, T1): the list of sessions from `collect("projects")` pieces; tmux names; folder; `sessionOf(process.env)`; `chatOf`. Grows in T2 (target folder for a message or a project) and T4 (`orchestration.sessions`).
- `packages/orchestration/src/coordinator.ts` (T1): `supervise` takes a session (folder, tmux name, context command, extra args and env) and a shared start chain; `extensions()` skips an `undefined` answer; a `down` mark when an agent ends (T3).
- `packages/orchestration/src/coordinator-commands.ts` (new, T1): `attach [<project>]` and `coordinator stop|context [<project>]`, moved from `orchestration.ts`.
- `packages/orchestration/src/orchestration.ts`:
  - T1: piece, the duplicate-place refusal, `orchestration.project`, the role `project`, one supervisor per session, the doctor line, `orchestration.chats`;
  - T2: start-time recovery of a removed agent's inbox;
  - T4: `coordinator.restart` with `project`, `orchestration.sessions`.
- `packages/orchestration/src/orchestration-options.ts` (T1): `roles.project.model` must be one model name.
- `packages/orchestration/src/spawn-rules.ts` (T1): the spawn and continue guard for an agent's session.
- `packages/orchestration/src/actor.ts` (T1): `agent:<project>`.
- `packages/orchestration/roles/project.md` (new, T1): the project agent's role, adapted from `coordinator.md`, with `[from …]` marks and `arthur agent tell coordinator` for work across projects.
- `packages/orchestration/src/inbox.ts` (T2):
  - routing of `message-received`, `job-ended`, `coordinator-message` (`project`) and `agent-told`;
  - the seen-check across sessions;
  - one footer per session;
  - the sweep per session folder, adding `place`, `instance` and `channels` from the chat.
- `packages/orchestration/src/wake.ts` (new, T2): `wake()` and `turn()`, moved out of `inbox.ts`.
- `packages/orchestration/src/agent-command.ts` (new, T2): `arthur agent tell`. Doc page `packages/orchestration/docs/commands/agent.md`.
- `packages/orchestration/src/hand-over.ts` (T2): the `[from <sender>]` mark, counted as not the owner.
- `packages/orchestration/src/inbox.ts` `Message` type (T2): `from?`.
- `packages/orchestration/src/blocked-notice.ts`, `voice-reply.ts` (T2): the chat's place on the notice and the voice note.
- `packages/orchestration/src/decision-commands.ts`, `decision-writes.ts`, `autopilot.ts` (T2): `projectOf` refuses another project's id from an agent; `proof(sessionFolder, …)`; the recorded notice to the session's chat; the autopilot guard.
- `packages/orchestration/src/decision-hooks.ts` (T2): `project` in its `coordinator-message`.
- `packages/orchestration/roles/coordinator.md` (T2): route work for a project with an agent through `tell`; `[from agent:<p>]` messages are no owner's word.
- `packages/orchestration/src/context.ts`, `decision-context.ts` (T3): the one-project context, the slots line, the agents' up/down lines.
- `packages/telegram/src/telegram.ts` (T1, T2): the topics doctor line; bot by `instance`; notice place only for its own channel.
- `packages/discord/src/discord.ts` (T2): bot by `instance`; notice place only for its own channel.
- `packages/delivery/src/ci-wait.ts`, `hand-back.ts`, `pass-forward.ts`, `merge-recovery.ts`; `packages/github/src/github.ts`; `packages/uptime/src/uptime.ts` (T2): `project` in each `coordinator-message` they word per project.
- `packages/stats/src/session-extension.ts` (T1): `SESSION` from `ARTHUR_ORCHESTRATION_SESSION`, else `coordinator`.
- `packages/core/src/cli.ts` (T1): `ARTHUR_PROJECT` as the `--project` default. `packages/core/docs/commands/help.md` or the CLI doc that lists `--project` [INFERENCE: which page documents `--project` was not opened].
- `packages/session/src/session.ts` (T1: answer only the coordinator's session; T4: sessions, compaction one at a time).
- `packages/session/src/restart.ts` (T4): per session.
- `packages/session/src/restart-command.ts` (new, T4): `registerRestart`, moved out, with `/restart` per chat.
- `packages/session/src/start-notice.ts` (T4): the probe and notices per session.
- Docs and spec:
  - `packages/orchestration/docs/commands/coordinator.md`, `attach.md`, `docs/orchestration.md`; `packages/session/docs/session.md`, `docs/commands/restart.md`; `packages/telegram/docs/telegram.md`; `packages/discord/docs/discord.md`; `packages/stats/docs/stats.md`;
  - `spec/roadmap.md` entries 85 to 88: role file name, cwd, the routing of plugin messages, the doctor line in place of "refused at load";
  - `CHANGELOG` [INFERENCE: its file name was not checked].
- `test/structure.test.ts`: the budget raises of each ticket.

## Risks
- **The `arthur` CLI needs `arthur.config.ts` in its working folder** (`config.ts:50-52`). Roadmap 85's `--cwd <project folder>` would break every `arthur` command the agent runs. The plan starts the agent where `arthur run` runs, as the coordinator, and `--session-dir` keeps its conversations apart (Open questions).
- **Two `omp` refreshing the shared login at once.** All starts go through one chain in `arthur run`, each after the previous agent's `exitWaitSeconds` wait, as now.
- **The handoff extension in an agent writing the coordinator's `agent` pid file** would break `/restart` tracking. Until T4, the session plugin answers `undefined` for every session but the coordinator.
- **A reply or notice sent to the wrong chat.** Topic ids and channel ids can both be plain digits, so a reply from a project agent names `channels: [chat.plugin]`, and the other channels ignore a `place` that is not theirs. The bot is picked by `instance` when no answered message names one.
- **Silent mode holding an agent's reply to the owner.** `held` keeps reading only the owner channels a turn answered, not the chat added for routing.
- **Lost or doubled messages.** One `received/` queue keeps the order. The seen-check covers every session's boxes, so a replayed event is never queued twice. A removed agent's queue moves to the coordinator at start.
- **The guards are a check against mistakes, not a security boundary.** A project agent runs as the same user with `--auto-approve`, as trusted as the coordinator, and could set the variables itself. What they stop is the likely slip: another project's spawn, decision or default board.
- **Project names may hold `.`**, which tmux reads in a target. Replacing it with `_` is one-to-one, because project names have no `_` (`projects/src/project-options.ts:14`).
- **Plugin lines in a project agent's context** (projects, retro-due) speak of every project. They are kept unchanged, as data. Filtering them would touch each plugin.
- **Files near or past 200 lines.** `inbox.ts` (200), `inbox-extension.ts` (197, untouched), `orchestration.ts` (172) and `restart.ts` (216) are split as listed. No file is planned into the red zone.
- **Memory.** About 0.7 GB per agent outside the jobs' slice. The doc says so; nothing enforces it.

## How to test
- **This ticket's Done means.** `plan.md` is this text, and no code changed. In this checkout `npm run check` passed, and `npm test` ended with 1828 tests: 1764 passed, 64 skipped, 0 failed (exit 0).
- **Every follow-up ticket:** `npm test` and `npm run check`. The `coordinator.test.ts` tests use the fake agent and a tmux socket in the test's folder; T2 extends `inbox-setup.ts`; T4 extends `session-setup.ts` and `restart-setup.ts`.
- **T1 (roadmap 85's Done means), in `coordinator.test.ts`:**
  - Load refused, naming the projects: two projects with one place on one channel; a `chat` of the wrong shape (the piece check, `project <name>: orchestration.project(...): …`).
  - A chat whose plugin provides no `channel.send` is a critical doctor line, and `arthur run` does not start.
  - No project with a `chat`: only the coordinator starts, its `starts.jsonl` args as before.
  - Two agents: one crashing in a loop (`exitCode: 1`) leaves the coordinator and the other running, its restarts never faster than `restartDelaySeconds`.
  - Starts never overlap (each start is after the previous one's).
  - `attach <project without agent>` names the projects that have one.
  - `coordinator stop shop` is refused while a shop job runs, and stops only shop's session otherwise.
  - Each agent's args hold `--session-dir`, `--plugin-dir` with `mcp.roles.project`, and its `ARTHUR_ORCHESTRATION_SESSION`, `ARTHUR_PROJECT` and folder variables. `roles.project.model` as a list is refused.
  - A spawn of another project from an agent's env is refused.
  - `actor` answers `agent:shop`.
  - In telegram's tests, `has_topics_enabled: false` gives a doctor line naming the setting.
  - In core's `cli.test.ts`, a command gets `ARTHUR_PROJECT` as its project and `--project` wins over it.
  - In stats, the extension writes `sessions/agent:shop.jsonl`.
- **T2 (roadmap 86's Done means), in `inbox.test.ts`:**
  - A message in shop's place lands in shop's inbox; one in the main chat or an unknown place lands in the coordinator's.
  - A message for an agent that is down waits and is handed over once it is up.
  - A job of a project whose agent was just removed wakes the coordinator, and that agent's queued messages move there.
  - Nothing is handed over twice across a restart of either session (the same event replayed).
  - `tell` to an unknown agent is refused, naming those that exist; a `[from coordinator]` message is marked and attributed to the agent.
  - A reply carries `place`, `instance` and `channels`, and while silent the agent's reply to an owner message is still sent.
  - A blocked job of shop sends its notice to shop's place.
  - `coordinator-message` with `project` wakes shop's agent.
  - In `decisions.test.ts`: an agent's `answer` proves only from its own inbox; another project's id is refused; a `[from]` text never proves.
  - In the Telegram and Discord tests: the bot by `instance`, and a notice with another channel's place goes to the main place.
- **T3 (roadmap 87's Done means), in `context.test.ts`:**
  - A project without a vision file gets a warning line, not a failure.
  - A job of another project never shows in the agent's context but counts in `Slots: n of maxAgents`.
  - An agent down shows `down since` in the coordinator's context, and an agent up shows `up since`.
- **T4 (roadmap 88's Done means), in `session.test.ts` and `restart.test.ts`:**
  - An agent's fresh start is not held back by another project's job.
  - `/restart` from the main chat restarts the coordinator only; from shop's place, only shop.
  - One session's failed handoff withdraws only its own compaction.
  - Compactions never overlap.
  - Each session's start, `Restarted.` and turn-failed notices go to its own chat.
  - With no project agent, the existing tests of entries 35 to 38 pass unchanged.

## Open questions
- **Roadmap 85 says `--cwd <project folder>`, but the agent directs its jobs through `arthur spawn`, which only finds `arthur.config.ts` in its working folder.** The plan starts the agent where `arthur run` runs, with its own `--session-dir`. Is that what you want?
- **Silent mode.** The plan keeps one switch for every chat: `/silent` or `arthur silent on` in a project chat also quiets the coordinator's replies. Or should each chat have its own silent mode?
- **`maxAgents`.** The plan reserves nothing per project: the first spawn takes the slot. Or should each project agent be capped at fewer slots than `maxAgents`?
- **Two agents on one project.** The plan follows roadmap 86: the coordinator's role sends work for a project with an agent through `arthur agent tell`, and nothing enforces it. Or should Arthur refuse the coordinator's own spawns and merges in a project whose agent is up?
- **Plugin messages.** The plan sends CI results, delivery's merge results and uptime alerts about a project to that project's agent, by adding `project` to the messages delivery, github and uptime already send. Roadmap 86 routes only job ends. Do you keep this, or should those messages stay with the coordinator, who passes them on?