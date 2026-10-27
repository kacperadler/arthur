# AR0527 - Plan

- Job: 2026-10-27-plan-2922b651
- Planned at: 7824c31950dfedbaa0fda92ec2410b0118f2ef3b

## Approach
This ticket changes only this plan. It writes no code and does not touch the roadmap or the vision. I ran the checks at HEAD in this checkout: `npm run check` (tsc) is clean, and `npm test` gives 1222 tests, 1161 pass, 0 fail, 61 skipped.

**What I recommend, in short.** A new `activity` plugin keeps one JSON-lines file per day under its own folder. Every line says who did it, what they did, and on whose message they did it. Only the running `arthur run` process writes these files, and it builds them from the events the core already sends. The core gets three small additions:
- Every event gets a stamp saying who emitted it.
- A shell command that ran becomes an event (`command-ran`).
- A phone command that arrived becomes an event (`phone-command`).

Orchestration tells the core when a command comes from the coordinator's session, and which messages that turn is answering. Left alone:
- The event log `<home>/events.jsonl` keeps its role and its lines; only the stamp is added.
- The decision log, the job records, `arthur stats` and every channel's message contract stay as they are.

**1. Actors: how a line names who acted.**
- Option A, the emitting plugin only (`event.plugin`, as today): costs nothing, but it cannot tell the owner from the coordinator from a job. `delivery ticket-moved` and `core ticket-moved` are already 689 of the 2846 live events, and none of them names who asked.
- Option B, an `actor` field on `command-ran` only, with each command's own events listed inside it: a smaller core change, but a reader has to join events afterwards, and the server stream (roadmap 75) still has no actor.
- Option C, a stamp on every event, `by: { actor, on? }`, set once per process by the core: `on` lists the event numbers of the messages being acted on.

Recommendation: C. The actor is worked out in this order:
1. Inside a job: `job:<id>`, from `insideJob` (`packages/core/src/inside-job.ts`).
2. Else, if a plugin answers `provide("actor")`, its answer. Orchestration answers `coordinator` when `process.env.ARTHUR_ORCHESTRATION_FOLDER` is its own folder. That variable is already set in the coordinator's tmux session (`coordinator.ts:120`). `on` is the event numbers in the names of the files in its `inbox/turn/` (`<seq>-<ms>`): the messages of the turn in progress. Project agents (85) answer `agent:<project>`.
3. Else, the process that holds `<home>/run.pid`: `arthur`.
4. Else: `user:terminal:<OS user>`.

How a line shows the actor:

| Actor | Who |
| --- | --- |
| `user:<channel>[/<instance>]` | the owner on a channel; from `message-received` or `phone-command` |
| `user:terminal:<OS user>` | someone typing in a shell |
| `coordinator`, `agent:<project>` | the coordinator, a project agent |
| `job:<id>` | a job; its line also carries `kind` and `ticket` |
| `plugin:<name>` | a plugin acting inside `arthur run` |
| `arthur` | the core inside `arthur run` |

What ties an action to a message: `on`. Jobs inherit it: the coordinator's `arthur spawn` stamps `job-started` with its `on`, and every later line of that job carries the job's id. Lines of plugins and of `arthur` have no `on` unless the event's own data names one (`coordinator-replied.answers`).

What this gives AR0502:
- The `command-ran` of `arthur decision answer` already carries the turn's message numbers. AR0502's check can look for a `message-received` from a channel, sent after the question was asked, whose text names the decision id. It no longer needs to trust a `--message <seq>` the coordinator types.
- A stamp is attribution, not proof. The coordinator could clear the variable and pass as `terminal`. AR0502's gate must not count `user:terminal` as the owner's word until the coordinator runs in its own systemd scope, as jobs do (AR0443's pattern). That stays AR0502's decision.

**2. What is logged.** The plugin subscribes to a fixed list of events, and that list is the answer to "what is logged".

Events the core and the plugins already send (counts are from the live log, 2.36 days):

| Event | Live count | Logged |
| --- | --- | --- |
| `message-received` | 113 | yes |
| `coordinator-replied` | 242 | yes |
| `coordinator-message` | 119 | yes |
| `notice` | 65 | yes |
| `job-started` | 391 | yes |
| `job-state` | 506 | only to `blocked` or `ended` |
| `job-ended` | 388 | yes |
| `ticket-created` | 122 | yes |
| `ticket-moved` | 690 | yes |
| `ticket-after` | 99 | yes |
| `ci-finished` | 111 | yes |
| `stop-all` | not seen | yes |
| `pull-request-review`, `cap-reached`, `machine-online`, `machine-offline`, `disk-low`, `uptime-down`, `uptime-up` | not counted | yes |

What is missing today, and is added (roadmap entry 99 below):
- **A command run from the shell, the coordinator's own commands included:** `command-ran { command, args, project?, code }`, sent by `cli.ts` after the command returns. It is not sent inside a job, where the sandbox does not let a job write `<home>/events.jsonl` (spawn.md, "The sandbox"), nor inside an eval, nor when the config did not load (there is then no event bus). This one event covers steer, stop, continue, merge, `decision ask` and `decision answer`, `ticket` and `schedule add`. None of those has an event of its own today: I grepped `emit(` in `delivery/src`, `orchestration/src`, `job-commands.ts` and `decision-log.ts`.
- **A command from a channel:** `phone-command { channel, place?, instance?, text }`, sent where `plugin-host.ts:106` hands `commands.route` to the plugins. Today `/stopall`, `/steer` and `/restart` leave no trace (`telegram/src/poll.ts:80-85`).
- **A schedule entry fired:** `schedule-fired { id, slot, late, does: action | job | run }`, from `schedule/src/sweep.ts:38`. Today a scheduled job's `job-started` does not say the schedule started it.
- **A restart:** `run-started { pid, plugins }` from `run.ts`. The stop is the `command-ran` of `run`, and session's `Restarted.` notice stays.
- **A user's message:** already there, as `message-received`. Only the terminal chat through `arthur attach` is missing (Not available directly).

Read-only commands (`jobs`, `help`, `coordinator context`, which runs on every turn) are logged by the core but hidden by `arthur log` unless `--all` is given.

How text is kept:
- **Whole:** a second copy of every word, about 285 KB a day of coordinator replies alone.
- **Cut:** one line, the first `textChars` characters (default 300), with `cut: <full length>` and `seq`. The whole text stays in `events.jsonl` under that number.
- **Reference only:** `textChars: 0`.

Recommendation: cut, at 300.
- Media parts are logged as `[voice 12 s]` or `[photo]`, without the path.
- A part someone forwarded starts with `[forwarded from <name>]` (`telegram/src/media-in.ts:44`). It is logged as `[forwarded, N chars]`: neither the third party's name nor their words go into the day file.
- Secret values: the event log replaces every value of 8 or more characters from the env with its variable's name before anything subscribes (`event-log.ts:append`, `secret-names.ts`). Lines made from logged events therefore hold no such value, and no second redaction is needed. A secret that is not in the env (a password pasted into chat) is not known to Arthur; the cut only shortens it. The same is already true of `events.jsonl`.

**3. Files.**
- One file per day: `<home>/activity/days/YYYY-MM-DD.jsonl`, the date taken from `host.clock.local(new Date(event.time)).date` in `core.timeZone`.
- One line per event: `{ seq, time, actor, on?, plugin, what, project?, ticket?, job?, kind?, text, cut? }`. `what` is the event's name, or `command <name>` for `command-ran`.

Several writers, options:
- (a) Each process writes under `@arthur/core/lock` and skips numbers already in the file. Two processes then race on the order of lines.
- (b) Only `arthur run` writes.

Recommendation: (b). It is the one process that receives every event: its own when they are sent, everyone else's when it reads the log (`events.ts`, `follow`).
- The plugin queues lines in memory. At `start` it sorts the queue by number and writes it. From then on it writes each event as it arrives. A command process never calls `start`, so it never writes.
- An event whose number is not above the last line already written is skipped, so a replay after a crash writes nothing twice.
- If the queue's first number leaves a gap after the last line written (lost `events.delivered`), the plugin calls `host.events.read(last + 1)` once.
- Each line is one append ending in `\n`. A last line cut by a crash gets its line break first, as `event-log.ts:append` does. A reader skips a line it cannot parse.

Retention, options:
- Forever.
- `keepDays` (default 90), old day files removed by name at `start` and at the first write of a new day.
- Folded into manage's prune.

Recommendation: `keepDays: 90`, inside the plugin itself, with no dependency on schedule.

Size: I replayed the live log with every text cut to 300 characters: 1160 lines and about 324 KB a day with every field kept. 90 days is therefore at most about 30 MB. A compact line is smaller.

Git: never committed. `.arthur/` is git-ignored (`.gitignore`), and the day files hold the owner's words and real project names, which the vision (line 27) keeps off GitHub. There is no export into `spec/`.

**4. Plugin.**
- The core's event log: changes every reader of the log and adds to a core already at its budget (6414 of 6414).
- `manage`: at its budget (928 of 928). It would also mix private words into "managing Arthur".
- One plugin shared with stats (AR0480): different retention (stats keeps everything, small; activity keeps 90 days) and different privacy (stats holds numbers, activity holds words).
- A new plugin `activity`.

Recommendation: a new `activity` plugin, optional, made with `arthur plugin new activity --budget 350`. 350 lines is my estimate for:
- the event-to-line mapping (about 80);
- the day files: writing, last line, retention (about 70);
- the plugin and its options (about 60);
- `arthur log` and `/log` (about 120).

Where it meets AR0480: both read `job-ended` and keep their own append-only file. Activity counts nothing. Stats may later link a cost to a job id that `arthur log --job` shows.

What the host interface needs: the stamp, the four new events, and orchestration's `provide("actor")`. Raises this needs, each a decision for entry 99's ticket:
- core: about 60 lines;
- orchestration: about 20 (at 2430 of 2430 today);
- schedule: about 3 (at 595 of 595).

**5. Views.**
- `arthur log [--day YYYY-MM-DD|today|yesterday] [--user <u>] [--actor <a>] [--ticket <id>] [--job <id>] [--project <name>] [--all]`. Default today, one line each: `HH:MM  <actor>  <what>  <text>`.
- `--user` shows that user's own lines plus every line whose `on` names one of his messages: "on whose word".
- `/log [today|yesterday|<date>] [<ticket id>] [job <id>]` on a channel: the last 30 lines, which the channel splits when long.
- Web panel (AR0086, roadmap 77) later: a Log screen with the same filters, reading `arthur log --json` through the server's commands (76). It is not built here.

**6. Several users.** Today every channel answers one user: Telegram only `from.id === bot.chat` (`poll.ts:61`), and Discord has its `userIdEnv`. So `user:<channel>[/<instance>]` already names exactly one person. When a channel answers several people (company edition, AR0131 and roadmap 79):
- `message-received` and `PhoneFrom` gain the sender's id as `user`, and the line becomes `user:<channel>[/<instance>]:<id>`.
- A Telegram id that is an env value is logged under its variable's name, which keeps it stable and free of secrets.
- The terminal (Arthur's own OS user) reads every line.
- A channel or panel user (the panel knows him by his Tailscale identity) reads his own lines, the lines on his word, and lines of no user.
- A role's manager (79) reads his role's lines.
- Project agents (85 to 88): actor `agent:<project>`, `on` from that agent's own turn; `/log` sent from a project's place defaults to that project.

None of this rule is built until 79. The `user` and `on` fields on every line now mean no old file has to be rewritten then.

**7. Roadmap.** New entries, numbered after 98:
- **99. Who did it.** The `by` stamp, `command-ran`, `phone-command`, `run-started`, `schedule-fired`, orchestration's `actor`. Packages: core, orchestration, schedule. Depends on 51; a change to the frozen API is a decision.
- **100. The activity log.** The plugin, the day files, the single writer, retention. Depends on 99.
- **101. `arthur log` and `/log`.** Depends on 100.

Existing entries that change:
- 77 gains the Log screen.
- 79 gains the read rule.
- AR0502's fix uses 99's `on`.

Where these go in the order is an open question.

## Not available directly
- **A plugin cannot subscribe to every event.** Handlers are kept by event name (`events.ts`, `on(plugin, name, fn)`), and `host.events.read` reads all of `events.jsonl` on every call (`event-log.ts:readEvents`); the live log is already 948 KB after 2.36 days.
  - Option 1: subscribe to a fixed list of names. Cost: none in the core. Risk: a new plugin's event is not logged until the list gains it.
  - Option 2: add `on("*")` to the core. Cost: about 5 core lines and a change to the frozen API. Risk: everything gets logged, noise included.
  - Option 3: poll `read()`. Cost: none in the core. Risk: reads the whole log every tick, and the log grows without end.
  - Recommendation: Option 1.
- **The terminal chat through `arthur attach` is not an event.** The owner types straight into omp. The inbox extension only listens to `session_start`, `agent_start`, `tool_result`, `session_stop` and `agent_end` (`inbox-extension.ts:20-25`). The omp here (18.3.0) is a compiled binary, and I did not find in it an extension event for typed input.
  - Option 1: leave it out; the coordinator's actions show `on: []`. Cost: none. Risk: an action made on a word given in the terminal looks unasked.
  - Option 2: an omp hook for typed input, if one exists. Cost: about 20 orchestration lines. Risk: an omp API that is not confirmed.
  - Option 3: read omp's session file. Cost: a parser. Risk: tied to omp's internal format.
  - Recommendation: Option 1; entry 99's ticket checks whether Option 2 exists.

## Files
- `spec/features/AR0527-plan-an-activity-log-plugin-what-each-user-and-each-agent-or-the-harness-did-one/plan.md`: this plan, filed with `arthur ticket file`. Nothing else changes in this ticket.
- For entry 99 only, not this ticket:
  - `packages/core/src/event-log.ts`, `events.ts`, `host.ts`: the stamp.
  - A new `packages/core/src/actor.ts`: the order in which the actor is worked out.
  - `cli.ts`: `command-ran`. It has 199 lines today, so the core's command list moves into its own file.
  - `plugin-host.ts`: `phone-command`.
  - `run.ts`: `run-started`.
  - `packages/orchestration/src/` (a new `actor.ts`, wired into `orchestration.ts`).
  - `packages/schedule/src/sweep.ts`.
  - `docs/plugin-api.md`.
- For entries 100 and 101 only: `packages/activity/`, created by `arthur plugin new`, and its docs.

## Risks
- **Breaking the build with this ticket:** it writes only `plan.md`. `npm run check` and `npm test` pass at HEAD.
- **Two writers out of order:** only `arthur run` writes, after `start`, sorted, skipping numbers already written.
- **Events lost before `start`:** `follow` replays the log before `start` (`run.ts`). The plugin keeps those events in memory and writes them at `start`. A gap is filled with one `read()`.
- **A job inherits the coordinator's environment** through `arthur spawn`, so the job check comes first. The job wrapper runs without `ARTHUR_JOB` in its own environment (`wrapper.ts:129` sets it for the agent only). On a machine without a systemd scope it would be stamped `coordinator`; entry 99 has the wrapper stamp `job:<id>` itself.
- **A job writing events from inside its sandbox:** `command-ran` is never sent inside a job.
- **Core, orchestration and schedule are each exactly at their line budget:** every raise is named in the follow-up ticket as a decision.
- **Number clash:** AR0480's plan may also claim 99 and up. Whichever plan is approved second renumbers.
- **Privacy:** a line keeps 300 characters of text, no forwarded words, no media path, and is never committed.

## How to test
- The Done means point "`plan.md` with options and a recommendation for each" is checked by reading the plan:

| Done means sub-point | Where the plan answers it |
| --- | --- |
| Actors | Approach §1 |
| What is logged | Approach §2 |
| Files | Approach §3 |
| Plugin | Approach §4 |
| Views | Approach §5 |
| Several users | Approach §6 |
| Roadmap | Approach §7 |

- "No code; `npm test` and `npm run check` pass": run at HEAD in this checkout. `tsc` is clean; 1222 tests, 1161 pass, 0 fail, 61 skipped. This ticket changes only `plan.md`.

## Open questions
- Should entries 99 to 101 be built before the project agents (85), right after the Docker entries, or under "Later" with the company edition (79)? I recommend before 85: project agents then get their own actor from the start.
- Are 90 days and 300 characters the right defaults? I recommend them; the measured upper bound is about 30 MB.
- Should a forwarded message keep the sender's name? I recommend no: only `[forwarded, N chars]`.