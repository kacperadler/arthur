# AR0098 - Plan

- Job: 2026-10-17-plan-ticket-spec-feature-d8979829
- Planned at: 5f1b95d7b50a63fea59f8d7fb941a0a6dea461da

## Approach

TL;DR for the owner: recommend **B**. The coordinator stays. A project can also get its own agent, which talks with you in that project's own chat: a Telegram topic, a Discord channel or a Slack channel. Discord and Slack become later channel plugins. Both make outbound WebSocket connections only, so nothing is exposed to the internet. This ticket only proposes. Nothing in the vision, roadmap, code or config changes until you approve.

What a project agent is in A, B and C: one more always-on interactive `omp`, supervised exactly like the coordinator in `packages/orchestration/src/coordinator.ts` (`supervise`). Its folder is the project's folder. Its context holds that project's vision, criteria, board and jobs. It works like the coordinator: it directs jobs through `arthur spawn` and `arthur ticket` and does not edit code itself.

### The three options

| | A: project agents only | B: coordinator plus project agents (recommended) | C: a config switch between the two |
|---|---|---|---|
| What you see | One chat per project and no general chat. Nobody answers "what is going on everywhere"; `/jobs` still answers without a model. A ticket that spans two projects has no owner. The morning report is either N reports or none. | The main chat stays as it is today: the coordinator, the morning report, `/jobs`, cross-project work, and every project without its own agent. A project with a `chat` gets its own topic or channel. That project's agent answers there, and that project's job ends, blocked questions and start notices arrive there too. | Today's single coordinator, or exactly A, depending on one config line. |
| `maxAgents` | The count stays enforced in code (entry 26's `beforeSpawn` counts every job, whoever spawns it). Nobody arbitrates, though: the first agent to spawn takes the slot, so one project can starve the others. Preventing that needs a new per-project cap option. | Unchanged. There is one global count at spawn, enforced for every session. Each project agent sees "slots in use, n of maxAgents" in its context. The coordinator sees every job and can stop or redirect one. No per-project cap (skipped: nobody asked for one). | A's rule in one mode, B's in the other. |
| Restart and compaction | N sessions, each with its own handoff. A project's fresh start waits only for that project's jobs. With no main chat, nothing obvious answers `/restart` from outside a project. The restart guard waits for all N. | 1+k sessions (k = projects with a `chat`). Each has its own handoff. Compaction at each `compactAt` runs for the sessions one after another, never in parallel. The coordinator's fresh start waits for every job (as today); a project agent's waits only for its project's jobs. `/restart` restarts the session of the chat it was sent from. The restart guard holds until every session that loaded the merged code has restarted. Each session sends its own start notice to its own chat. | Both behaviours, each tested in both modes. |
| Cost of several sessions | N always-on sessions. | 1+k sessions; with k = 0, exactly today's single coordinator. | Same as A or B, plus two code paths kept alive. |
| Roadmap and vision | Reverses vision decisions 10 and 14 and the Not-the-goal "a mode without a coordinator". Removes the coordinator session already built in entry 23 (merged as AR0094). Rewrites 24 to 27, 65 (now orphaned), 35 to 38, and 79 ("talk through the coordinator"). Adds a fair-share option. | Keeps decisions 10 and 14. Small field edits to 47 to 50 before the API freeze (51). Four new entries, 85 to 88. Entries 23 to 27 are extended by those new entries, not rewritten. | Everything A changes, plus a mode test matrix across 24 to 27, 35 to 38 and 65. The styleguide's "no option nobody asked for" argues against it. B with no project `chat` already is the "one coordinator" mode, so the only thing C adds is "no coordinator at all". |
| Rough size (estimate) | About 5 days of entries, plus the vision rewrite. | About 3.5 days of entries. | About 6 days or more. |

Measured cost of one always-on session, on this VPS (16 GB, 7 cores):
- **Memory:** the predecessor's interactive coordinator `omp` uses 717 MB of memory after 15 hours (`ps`); jobs use 386 to 500 MB each. Sessions sit outside the jobs' slice (`jobs.memory: "70%"` in `arthur.config.example.ts`). With k = 4, 1+k sessions take about 3.5 GB, which leaves about 1.3 GB for the system once the slice fills.
- **Tokens:** an idle session spends nothing. Each session spends one summarising turn per compaction (3 a day) and one per fresh start (1 a day). A project agent's turn reads one project's vision instead of every project's; Arthur's vision, styleguide and coordinator role together are 38 KB.

### What B changes, entry by entry

- **23** (merged): unchanged. New entry 85 reuses `supervise` once per project agent.
- **24** (inbox): unchanged now; entry 86 extends it with:
  - one inbox per session;
  - routing by `place`;
  - waking the agent of the job's project.
- **25** (context): unchanged now; entry 87 adds the project agent's context and one line per project agent in the coordinator's context.
- **26** (`maxAgents`): the rule is unchanged. The `roles` option gets a `project` key, which `checkOptions` in `orchestration-options.ts` already accepts as a role name.
- **27** (job state on channels): a notice for a job in a project with an agent carries that project's `place` (entry 86).
- **41** (merged): `projects` gains one key, `chat: { plugin, instance?, place }`, shape-checked in `packages/projects/src/project-options.ts` `FIELDS`, next to `tracker`. Its presence turns the project's agent on. Entry 85 delivers it.
- **47** (Telegram text): an incoming message's topic (`message_thread_id`) becomes `place`, and a send with a `place` passes `message_thread_id`. Telegram's docs say topics now work in the owner's private chat with the bot ("private chats of bots with forum topic mode enabled", `getMe.has_topics_enabled`). So the allowed chat stays one chat, with no group and no privacy-mode problem.
- **48** (Telegram outbox): an outbox slice keeps its `place`.
- **49** (media and the channel contract): `place?` added to `message-received`, `channel.send`, `coordinator-replied` and `notice`. This is the contract every channel uses, so it goes in before 51 freezes the host API.
- **50** (phone commands): `route` passes the message's `channel` and `place` to a phone command, so `/restart` knows which session to restart.
- **35 to 38** (session) and **65** (morning report): 35 to 38 become per session through entry 88; 65 is unchanged and stays with the coordinator.

### New roadmap entries for B (next free numbers; 84 is the highest today)

- **85. Project agents: their processes and `arthur attach <project>`** (orchestration, projects).
  - **Delivers:**
    - Each project with a `chat` gets one interactive `omp` in its own tmux session, named after the coordinator's session and the project (session name, then `-`, then the project name), on the coordinator's socket.
    - It starts with `--cwd <project folder>` and `--session-dir <home>/orchestration/<project>/sessions`. Each agent keeps its conversations in its own folder, so `--continue` never resumes the coordinator's conversation or a human's `omp` run in the same folder.
    - Its role file is `roles/project-agent.md`; `roles.project` gives the model and thinking level.
    - It has its own pid file and stop mark, so one agent crashing in a loop never touches another.
    - Sessions start one after another.
    - `arthur attach [<project>]` and `arthur coordinator stop [<project>]`.
  - **Refused at load:** a `chat` whose plugin provides no `channel.send`; two projects with one place.
  - **Depends on:** 23, 41, 49.
  - **Size:** a day.
- **86. Project agents: routing, wake, and `arthur agent tell`** (orchestration).
  - **Delivers:**
    - A message whose `place` some project's `chat` names goes to that project's agent; any other goes to the coordinator.
    - Replies go back to their `place`.
    - A job's end wakes the agent of the job's project, else the coordinator.
    - A blocked-on-user notice goes to that project's place.
    - `arthur agent tell <project|coordinator> <text>` puts one message, marked `[from <sender>]`, in another session's inbox, so cross-project work passes through the coordinator.
  - **Edge cases:**
    - A message for a project whose agent is down waits in its inbox and is delivered when the agent is up.
    - A job of a project whose agent was just removed wakes the coordinator.
    - Nothing is delivered twice across a restart of either session.
    - `tell` to an unknown agent is refused, naming the agents that exist.
  - **Depends on:** 85, 24, 27.
  - **Size:** a day.
- **87. Project agents: their context** (orchestration).
  - **Delivers:**
    - Entry 25's context for one project: its vision, warnings for missing criteria files, its board digest, its jobs by state, the slots of `maxAgents` in use, the time and whether it is night.
    - In the coordinator's context, one line per project agent: up since, or down since.
  - **Depends on:** 86, 25.
  - **Size:** half a day.
- **88. Session: every session** (session; asks orchestration for the list of sessions through `provide`).
  - **Delivers:** the per-session handoff, compaction, fresh start, `/restart`, restart guard and start notice described in the table above.
  - **Depends on:** 87, 35 to 38.
  - **Size:** a day.

### Discord and Slack, under decision 3

Both are channels on the same contract: `parts`, `channel.send`, files under `.arthur/<channel>/`, and `place` = a channel id. Both are named instances like telegram's `bots`. Both connect out over Node 24's built-in `WebSocket` (checked: `typeof WebSocket` is `function` on v24.21.0), so neither needs a runtime dependency. Neither sets an Interactions Endpoint URL or a Request URL, so nothing listens. "One allowed chat" becomes: one server or workspace, and in it only the owner's user id.

- **89. Discord: gateway, text in and out.**
  - **Delivers:**
    - The gateway protocol: Hello, heartbeat with jitter, Identify with the GUILDS, GUILD_MESSAGES and MESSAGE_CONTENT intents.
    - Resume through `resume_gateway_url` after a drop.
    - Sending through REST `POST /channels/{id}/messages`, at most 2000 characters per message, sliced at line breaks.
    - A 429 waits as long as its `retry_after` says.
    - An outbox as in 48.
  - **Edge cases:**
    - A missed heartbeat ACK closes the connection and resumes.
    - Opcode 7 (reconnect) resumes.
    - Opcode 9 (invalid session) re-identifies with backoff. Discord resets the bot token after 1000 IDENTIFYs in 24 hours, so a reconnect loop must resume and never re-identify in a tight loop.
    - Close code 4014 (disallowed intent) names MESSAGE_CONTENT and the setting in Discord's developer portal; 4004 (bad token) never prints the token.
    - A message from another user, or from the bot itself, is ignored.
  - **Size:** a day.
- **90. Discord: media and phone commands.**
  - **Delivers:**
    - Attachments become `parts`.
    - Media goes out as multipart `files[n]`: up to 10 files per message, at most 25 MiB per request.
    - `/name text` typed as plain text is routed to the command registry. No application commands, so there is no interaction to answer.
  - **Size:** a day.
- **91. Slack: Socket Mode, text in and out.**
  - **Delivers:**
    - `apps.connections.open` with the app-level token (`xapp-`), then the WebSocket.
    - Each envelope is acknowledged with its `envelope_id` at once.
    - Reconnect on a `disconnect` message or a drop.
    - Events API `message` events from the allowed user in the allowed workspace (team id).
    - `chat.postMessage` with the bot token (`xoxb-`), sliced.
    - A 429 waits for `Retry-After`.
  - **Size:** a day.
- **92. Slack: media and the `/arthur` command.**
  - **Delivers:**
    - Files in are fetched from `url_private_download` with the bot token.
    - Files out go through `files.getUploadURLExternal`, then the upload, then `files.completeUploadExternal`.
    - One slash command `/arthur <name> <text>`, routed as `/name text` (see Not available directly).
  - **Size:** a day.
- **Order of the later entries:**
  1. 85 to 88.
  2. 73 signal: still the cheapest, one local process.
  3. 89 and 90 Discord.
  4. 91 and 92 Slack. Both are official bots with no ban risk, but each is a gateway client that has to stay alive.
  5. 74 WhatsApp: decision 3 keeps it last of the channels, so its "Depends on" becomes 92.
  6. 75 to 77 server.
- **Why not sooner:** Telegram topics already give per-project chats in the first version, so Discord and Slack don't need to move up.
- Teams: left out.

### Vision edits proposed (not made)

- **Decision 10:** add "A project may have its own agent beside the coordinator (20)."
- **Decision 3:** "One channel interface; a message may name its place (a topic or a channel), which a project's `chat` maps to its agent; WhatsApp last of the channels."
- **New decision 20 (the owner, 2026-10-17):**
  - Option B as chosen.
  - Discord and Slack are channels, later, after signal and before WhatsApp.
  - Teams not for now.
- **"What stays true", bullet 2:** the coordinator talks in the main chat. A project's agent talks in that project's chat and works only on that project. The coordinator keeps `maxAgents`, the morning report and the cross-project work.
- **"How it is built", "Each channel answers one allowed chat or number":** add "or one Discord server or Slack workspace, and there only the owner's user".
- **The coordinator section:** "It directs every project" becomes "every project without its own agent, and the work across projects". The `roles` row adds the project agent.
- **Plugins table:** add rows for `discord` (named, later) and `slack` (named, later).
- **Later-plugins order:** signal, discord, slack, whatsapp, server.
- **"Where the less obvious parts live":** add "A project's own agent and the routing of its chat: `orchestration`; the place it answers in: the project's `chat` key in `projects`."

### Left alone

- The core, and every merged entry's behaviour.
- The rule "no mode without a coordinator".
- `maxAgents` code.
- The morning report.
- Every project without a `chat`.

## Not available directly

- **Slack:**
  - **What is missing:** a plain-text `/jobs` message. Slack treats a message starting with `/` as a slash command and rejects an unknown one, so a channel cannot just route `/name text` as Telegram and Discord do. I did not test this in a Slack client [INFERENCE]. Slack's Socket Mode docs (fetched) show slash commands arriving as `slash_commands` envelopes, which needs no Request URL.
  - **Option 1:** one registered command `/arthur <name> <text>`, routed as `/name text`. Cost: one line in the app's manifest. Risk: the human types a prefix on Slack only.
  - **Option 2:** a different plain-text prefix (for example `!jobs`). Cost: none. Risk: phone commands work differently on each channel.
  - **Option 3:** register every phone command in the Slack app's manifest. Cost: manifest upkeep. Risk: the manifest drifts from the command registry.
  - **Recommendation:** Option 1. Entry 92 follows it.

## Files

- `spec/features/AR0098-…/plan.md`: this plan. It is the ticket's only output (Scope: the plan only; Out: code).
- If you approve, a follow-up ticket makes the edits below; none is made here:
  - `spec/vision.md`: the edits under "Vision edits proposed".
  - `spec/roadmap.md`:
    - field edits to 47, 48, 49 and 50;
    - new entries 85 to 92;
    - 74's "Depends on" becomes 92;
    - the Order paragraph.
  - `docs/architecture/core-and-plugins.mmd`: discord and slack as later channels; a project agent beside orchestration.
  - `docs/architecture/versions.mmd`: Later becomes project agents, then signal, discord, slack, whatsapp, server.
  - `arthur.config.example.ts`:
    - `chat: { plugin: "telegram", place: "12" }` on `acme-shop`;
    - `roles.project`;
    - `discord({ enabled: false, … })` and `slack({ enabled: false, … })`, using `ARTHUR_DISCORD_*` and `ARTHUR_SLACK_*` variables.

## Risks

- **Two `omp` processes refreshing the shared login at once:**
  - **Why:** coordinator.md, step 3: a refresh token is used once.
  - **Avoided by:** entry 85 starts the sessions one after another. Whether long-running sessions also collide later is [INFERENCE]: jobs already run alongside the coordinator.
- **Mixed conversations:**
  - **Why:** the Arthur project agent and the coordinator share one folder, so `--continue` could resume the wrong conversation.
  - **Avoided by:** `--session-dir` per session. The flag is listed in `omp --help`.
- **Memory:**
  - **Why:** sessions run outside the jobs' slice, about 0.7 GB each.
  - **Avoided by:** agents are opt-in per project. Entry 85's doc page tells the owner to lower `jobs.memory` per agent added. Resources (34) measures free memory, so placement sees the sessions [INFERENCE: 34 measures free memory at each machine check].
- **API freeze:**
  - **Why:** if `place` is not in 47 and 49 before entry 51, adding it later is an API change that needs its own recorded decision.
  - **Avoided by:** the field edits come first.
- **Two agents acting on one project:**
  - **Avoided by:** the coordinator's role routes work for a project with an agent through `arthur agent tell`.
  - **Avoided by:** job wakes go to the job's project agent.
- **Discord token reset or empty messages:**
  - **Why:** too many IDENTIFYs reset the bot token; a disabled MESSAGE_CONTENT intent leaves message text empty.
  - **Avoided by:** entry 89's edge cases and a `doctor` requirement.
- **Telegram topics turned off:**
  - **Avoided by:** a `doctor` requirement reading `getMe.has_topics_enabled` whenever some project names a Telegram place.

## How to test

- **Three options compared, with what the owner sees and the cost:**
  - **Where:** the options table.
  - **Checks run:** the memory figures come from `ps` and `free -m` on this VPS.
  - **Not tested:** the token costs come from measured file sizes, not from a model run.
- **`maxAgents`, restart, compaction and session cost per option; entries 23 to 27, 41 and 47 to 50:** the table rows, and "What B changes, entry by entry".
- **Discord and Slack, no webhook, their place in the order:** "Discord and Slack, under decision 3".
  - **Checks run:** Node's built-in `WebSocket` on v24.21.0.
  - **From the docs (fetched):** Discord's gateway docs (resume, heartbeat, MESSAGE_CONTENT, the IDENTIFY limit); Discord's message limits (2000 characters, 25 MiB per request); Slack's Socket Mode guide (no Request URL, `envelope_id`, slash commands); Slack's external file upload.
- **Vision and roadmap edits proposed, not made:**
  - **Where:** the "Vision edits proposed" section and the Files list.
  - **Not run:** `git status` in the worktree. The planner has no write tools and edited no file.
- **New entry numbers are free:** the highest entry in `spec/roadmap.md` is 84 (grep).

## Open questions

- Which option: A, B or C? This plan, like the coordinator, recommends B.
- When do project agents come (entries 85 to 88)?
  - **Option 1 (recommended):** first among the later entries, after the other projects have moved to Arthur. Only then is there more than one project to split, and the first version's critical path stays as it is.
  - **Option 2:** in the first version, before the API freeze (51). This adds about 3.5 days of work before the first version ships.
- Which agent hears when a job ends: the agent of the job's project, whoever started the job (recommended; needs no core change)? Or the session that started the job? That would need a new field on the job record in the core.
