# session

The `session` plugin: the coordinator's one long conversation, compacted at set times during the day so it never overflows its context (roadmap entry 35), started fresh at night once no job runs, and restarted on `/restart` (entry 36). Before each, the coordinator writes its handoff, and the next conversation reads it first. Its restart guard holds new jobs once a commit changed the code `arthur run` loaded, until `arthur run` starts again (entry 37). At every start of `arthur run` it asks the coordinator's model for one word and tells the owner whether the coordinator is up, after what `arthur doctor` found missing, and it tells each coordinator turn that fails before any text (entry 38). It gives `arthur doctor` the user service and linger (entry 80). It needs `orchestration`, which runs the coordinator.

## Options

In `session({ ... })` in `arthur.config.ts`; every key optional:

| Option | Meaning |
| --- | --- |
| `compactAt` | The times of day the coordinator's conversation is compacted, each `"HH:MM"` (00:00 to 23:59) in `core.timeZone`. Default `["08:00", "13:00", "18:00"]`; `[]` never compacts. |
| `compactWaitSeconds` | How long a compaction waits for the coordinator to be idle, a whole number of seconds of at least 1. Default 1800. |
| `freshAt` | The time of day, `"HH:MM"` in `core.timeZone`, of the first try of the fresh start: a new conversation, without `--continue`, only once no job runs. Default `"23:00"`. |
| `freshRetryMinutes` | While a job runs, the fresh start is tried again this often, counted from `freshAt`; a whole number of minutes of at least 1. A try also waits this long for the handoff. Default 15. |
| `freshUntil` | The time of the last try, `"HH:MM"`; earlier than `freshAt` it is the next day, equal to it a single try. Default `"03:00"`. |
| `restartGuard` | `true` or `false`: once a commit changed the code `arthur run` loaded, refuse every spawn and continue until it starts again, and say so in the coordinator's context (below). Default `true`; `false` turns the guard off. |
| `probeLlm` | `true` or `false`: at every start of `arthur run`, ask the coordinator's model for one word before the start notice (below). Default `true`; `false` skips the probe, and the start notice says `coordinator up` without asking. |

Refused at load (and by `arthur config check`), naming the option: a `compactAt` that is not a list, an entry, `freshAt` or `freshUntil` that is not `"HH:MM"` (`compactAt[<index>]: expected a time "HH:MM" from 00:00 to 23:59, got <value>`, `freshUntil: ...`), a `compactWaitSeconds` or `freshRetryMinutes` that is not a whole number of at least 1 (`freshRetryMinutes: expected a whole number of minutes of at least 1, got <value>`), a `restartGuard` or `probeLlm` that is not `true` or `false` (`probeLlm: expected true or false, got <value>`), and any other option.

## The handoff

`arthur run` asks the coordinator for a compaction or a restart in `<home>/session/request.json`, one request at a time. The handoff extension, `packages/session/src/handoff-extension.ts`, which orchestration loads into the coordinator's agent (`arthur coordinator --help`, `coordinator.extension`), takes it and:

1. Waits until the agent is idle with nothing queued: no turn running and no message waiting in omp, for 2 s in a row, longer than the coordinator's inbox takes to hand over what it queued. Running jobs do not hold it back.
2. Asks the coordinator, as a message from Arthur, to write its handoff to `<home>/session/handoff.md`, replacing what it holds: the work in progress, the next steps, and every question to the owner still unanswered, with when it was asked. Its reply goes to nobody, unless an owner's message joins that turn.
3. When that turn has ended and the agent is idle, and the handoff is new (its modification time changed since step 2), the handoff is written. A compaction then compacts the conversation with omp's own compaction, as `/compact` does, and gives the compacted conversation the handoff, as a message from Arthur that holds its text; a restart says `handoff written` in the request, and `arthur run` restarts the coordinator.

At every start of the coordinator's agent, the extension notes its pid in `<home>/session/agent`, and, when the handoff is newer than the last one a conversation read, gives it to the new conversation as its first message: `[Arthur] The coordinator just started again. Before that you wrote this handoff (<path>); go on from it:` and its text. So the handoff carries the work in progress and the unanswered questions across every way a conversation ends: a compaction, a fresh start, a `/restart`, a crash. A handoff of only blanks is never read back, and one read (its modification time is noted in `<home>/session/handoff-read`) is not read again. A read that fails to reach the agent stays unread, for the next start.

A `request.json` that is not a request (edited by hand) is dropped: `session: <home>/session/request.json is not a request, so it is dropped: <its first 200 characters>`. A request is replaced by a restart while a compaction is still asked for: the extension drops the compaction, which then prints nothing.

The extension acts only in the coordinator's own session, one with a UI, never in a `task` subagent.

## Compaction during the day

`arthur run` looks at the clock every 500 ms. At each `compactAt` time it asks for a compaction, and prints the outcome, one line:

- `session: compact: done; the compacted conversation starts by reading the handoff`, or `session: compact: done; the handoff is empty, so nothing is read back`.
- `session: compact: skipped, session busy for <n> s`: the agent was not idle with nothing queued within `compactWaitSeconds` of the slot. The handoff is not asked for.
- `session: compact: skipped, handoff not written: <reason>`: the conversation is left as it was, not compacted. Reasons: `no new handoff when the coordinator's turn ended`, with omp's error in brackets when the turn ended in one; `no turn started within 30 s` after the request was handed over; `the request did not reach the agent: <error>`.
- `session: compact: failed: <omp's error, first line>`: omp's compaction threw; nothing is read back.

When it happens:

- No coordinator running at a slot: nothing happens and nothing is printed. The request is dropped once `compactWaitSeconds` have passed without an agent taking it, so a coordinator that starts later does not compact late; one that starts within that time does compact.
- A slot that passed while `arthur run` was down is skipped, not run late: the next slot is counted from the start, and a request left by the previous run is dropped at the start.
- Two slots close together never queue two compactions: a slot that comes while a compaction or a restart is still asked for or running is dropped, and slots passed together (a clock that jumped, a machine that slept) ask once.
- Daylight saving days: a time the spring gap skips (02:30 in Warsaw) comes at the first minute after the jump (03:00); a time the autumn repeat shows twice compacts at its first pass only.
- The coordinator restarting during a compaction: its request is dropped without a word once the agent that took it is gone.

## The fresh start at night

Every night from `freshAt` to `freshUntil` (across midnight when `freshUntil` is the earlier time), `arthur run` tries to give the coordinator a new conversation:

1. A try at `freshAt`, then every `freshRetryMinutes` after it, and the last at `freshUntil` itself, also when it falls between two of those.
2. A try made while any job runs, of any kind (worker, review, plan, audit, ...: every job in a run, as `arthur stopall` counts them), waits for the next try, without a line. After the last try: `session: fresh: skipped, <n> job(s) running at <freshUntil>`, and that night is over; a job that ends later starts nothing until the next night's `freshAt`.
3. With no job running, it asks the coordinator for its handoff (above), waiting up to `freshRetryMinutes` for it. A handoff that is not written withdraws that try with one line, and the next try asks again: `session: fresh: try withdrawn, handoff not written: <reason>; next try at <HH:MM>`, or after the last try `session: fresh: skipped, handoff not written: <reason> at <freshUntil>`. Reasons: those of a compaction above, `session busy for <n> s`, `handoff not written within <n> s`, or `the coordinator ended`.
4. Once the handoff is written, the jobs are counted again: a job started during the wait makes it a try that waits for the next one, as in step 2. With none, the coordinator's session is ended through orchestration's `coordinator.restart` with `fresh: true`, and orchestration starts it again without `--continue` (`arthur coordinator --help`): `session: fresh: done; the coordinator restarts in a fresh conversation, which starts by reading the handoff`. The next try is the next night's `freshAt`.
5. With no coordinator running, no handoff is asked: the restart is made at once, so its next start is a fresh conversation (`..., with no handoff: no coordinator was running`).

A night whose `freshAt` passed while `arthur run` was down is skipped, not run late: the first try is counted from the start. A window that passed unseen (a clock that jumped, a machine that slept) is not tried late either. Times the spring gap skips and the autumn repeat shows twice are taken as for `compactAt`.

Once the next coordinator is up, one `Restarted.` notice goes to every channel, `Restarted. (fresh session)` after a fresh start: `arthur restart --help`, which also covers `/restart` and `/restart fresh`.

## The restart guard

`arthur run` loads Arthur's code once, at its start, so a merge after that runs only once `arthur run` starts again. The guard holds new jobs meanwhile, so that the jobs running can end and the restart can be made, and nobody runs on code older than main without knowing it:

1. At its start, `arthur run` notes in `<home>/session/loaded.json` the time, the checkout that holds the core (Arthur's own: `git rev-parse --show-toplevel` of the core's package folder), its `HEAD` commit, and the code it loaded: the `src/` folder of the core and of each enabled plugin in that checkout, the host's `code` (the package folder around the module each plugin names as its own, its `import.meta.url`, whatever the package's name or place). A disabled plugin is not loaded, so its code is not watched; neither is a plugin that names no module (one written in the config), nor one whose package lies outside that checkout. With the core outside a Git checkout there is nothing to note and the guard does nothing.
2. At every spawn and every `arthur continue`, through `beforeSpawn`, of any kind, for any project, the checkout's `HEAD` is compared with the commit noted, only in those folders. A merge of docs, tests, roles or any other file does not count, and neither does one in another project's repository. A change that a later commit undid does not count either: the code at `HEAD` is the code loaded.
3. When it differs, a restart is due, and the spawn is refused, exit code 1: `refused by session: restart due: AR0153, 1a2b3c4 changed Arthur's code since arthur run started 2026-10-18 08:41 at 0a41782; restart arthur run once no job runs, or pass --ignore-restart`. Each commit on `HEAD`'s first-parent line since the one noted that changed that code is named by the ticket of its `Merge <id>: ...` subject, else by its short hash, oldest first; a `HEAD` moved back past the commit noted names the commit it is at.
4. `arthur spawn --ignore-restart` and `arthur continue --ignore-restart` start that one job all the same.
5. A restart of `arthur run` clears it: the service's `systemctl --user restart arthur` (`docs/deploy.md`, "Updating"), `/restart` under the service, which then ends `arthur run` so the service starts it again (`arthur restart --help`, step 6), or `arthur run` started again by hand. Its start notes the code anew. The fresh start, and `/restart` in an `arthur run` started by hand, restart only the coordinator's agent, so they do not clear it.

The coordinator's context gets one line on every turn (`arthur coordinator --help`, under `## session`): `Restart: none due; no commit changed Arthur's code since arthur run started 2026-10-18 08:41 at 0a41782.`, or `Restart: due, AR0153 changed Arthur's code since ...` and what that holds. Nothing while no note exists.

A `loaded.json` that is not what `arthur run` notes (edited by hand) refuses every spawn, `plugin session: beforeSpawn failed: <path> is not what arthur run notes at its start; it is noted again at the next start`, and the context gets `coordinator.context failed:` with the same words; `--ignore-restart` still starts a job. A Git command that fails (a commit noted that is gone) refuses the spawn the same way, with Git's first line: `git diff in <checkout>: fatal: bad object <commit>`.

## The start notice

So that the owner learns Arthur is up, and a model provider that fails (a login expired, a key revoked, a model gone) is found at the start instead of at the coordinator's first real turn:

1. At every start of `arthur run` (the service starting it again counts), the coordinator's model is asked for one word first: `<agent> -p --no-session --no-title --no-tools --no-extensions --no-skills --no-rules --mode json --model <coordinator.model> "Answer with one word: ready."`, the agent `core.agent.command`, the model the one orchestration answers for the role `coordinator` (`arthur roles`), the agent's own default when none is set. It runs beside the coordinator's own start and holds nothing back.
2. Answered with text, every channel gets one notice: `coordinator up on <host>`, `<host>` the machine's name.
3. Otherwise the notice is `no LLM access on <host>: <reason>; run omp login`. The reason is the first line of the model's error (`401 {"type":"error","error":{"type":"authentication_error",...}}`), else omp's `error: ...` line (`No API key found for anthropic.`), else its first line on stderr (`Model "<model>" not found`), else `no answer within 60 s` when the probe is cut after 60 s (the agent is killed), `the model's turn ended with aborted`, `no answer`, or `exit code <n>`.
4. With `probeLlm: false` nothing is asked, and the notice is `coordinator up on <host>` at once.

Two starts in a row send two notices, one each: nothing is merged or held back. An `arthur run` stopped while its probe runs kills the probe and sends no notice. The notice tells about the model; that the coordinator's tmux session started is in `arthur run`'s output (`arthur coordinator --help`).

The notice opens with the lines `arthur doctor` found missing that this start sends, one per line, before `coordinator up on <host>` or `no LLM access ...`: the core's `doctor` event, `{ lines }`, which `arthur run` emits before any plugin's start. A line is sent at most once a day (`arthur doctor --help`); with none to send, the notice is as above.

A coordinator turn that fails before any text (its last message an error, and none of its replies since the message that started it holds text) sends the notice `turn failed on <host>: <reason>`, the first line of omp's error, once per reason: while a provider is down the inbox hands its messages over again, and a turn that fails with the same first line as the failure told last is not told again; one with another reason is. The next turn that ends without an error after one told sends `turns work again on <host>` once, and the reason told before may be told again after it; an aborted turn is neither. The session's second extension in the coordinator's agent, `packages/session/src/turn-extension.ts`, leaves each in `<home>/session/turn-failed/`, and `arthur run` sends them within 500 ms, oldest first; one left before this `arthur run` started is dropped, not told late. A turn the owner aborted, one that replied before it failed, and one omp says goes on, are not told.

A credential is never repeated in either notice: in the reason, the value of every environment variable whose name holds `KEY`, `TOKEN`, `SECRET`, `PASSWORD`, `CREDENTIAL` or `AUTH` (8 characters or more), a `Bearer` token, a key with a vendor's prefix (`sk-`, `xoxb-`, `ghp_`, ...), and any run of 20 or more letters, digits, `_` and `-` that mixes letters and digits become `[redacted]`. The reasons are cut at 300 characters.

## arthur doctor

The plugin gives `arthur doctor` (`arthur doctor --help`) two requirements, neither critical, so `arthur run` starts without them:

- `session service`: the systemd user service `arthur.service` is installed (`LoadState=loaded`), enabled (`UnitFileState=enabled`) and has `Restart=always`, as `systemctl --user show arthur.service` says. Missing: `arthur.service is not installed`, `arthur.service is disabled, not enabled`, `arthur.service has Restart=on-failure, not always`; without it nothing starts `arthur run` at boot, or again after it ends; the fix is step 9 of `docs/setup.md`.
- `session linger`: `loginctl show-user <user> -p Linger --value` says `yes`. Missing: `linger is off for <user>`, so the user manager, and `arthur run` with it, starts only once the user logs in; the fix is `sudo loginctl enable-linger <user>`.

Without a systemd user manager (macOS, a container: `systemctl --user show-environment` fails) the plugin has no line; the core's `core controllers` line says so, once.

## Files

In `<home>/session/`: `request.json` (the request of the moment), `handoff.md` (the coordinator's handoff), `handoff-read` (the modification time of the last handoff read), `agent` (the pid of the coordinator's agent), `restarted.json` (a restart made, until the next coordinator is up; one that is not a restart's mark is dropped, named), `after-restart.md` (the steps for the human after a restart, sent once with `Restarted.`), `loaded.json` (what `arthur run` loaded at its start, for the restart guard), `service` (the pid of an `arthur run` that is the service's, from its start until it stops, for `/restart`), and `turn-failed/` (the coordinator turns that failed before any text, until `arthur run` sends them).

A file here that cannot be read, written or removed (a disk full, the folder made read-only) never ends `arthur run`: the 500 ms look that failed prints `session: <compaction|restart|turn notice> failed: <the error's first line>`, once per distinct error, and the next look tries again. A fresh start's try whose request could not be written is made at the first look that can write it; a night's restart that threw ends that night, and the next night tries again.
