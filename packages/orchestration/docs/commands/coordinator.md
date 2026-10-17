# arthur coordinator

Usage: `arthur coordinator stop`. Comes with the `orchestration` plugin, which every config holds.

## The coordinator's process

The coordinator is one interactive agent (`core.agent.command`, `omp`) in its own tmux session, `coordinator.tmux.session` (default `arthur`) on its own tmux server, `coordinator.tmux.socket` (default `arthur`: a name, as `tmux -L arthur`; one with a `/` is a socket path, as `tmux -S <path>`). `arthur run` keeps it running from its `start` until its `stop`:

1. At `arthur run`'s start, a stop mark left by `arthur coordinator stop` is lifted. A session already running under that name (left by an `arthur run` that crashed) is kept, not started twice.
2. Every 500 ms it looks at the session. When the session is gone, or its agent exited and the pane stayed (a `remain-on-exit` in the human's `~/.tmux.conf`; the session is then killed), the coordinator has ended, for whatever reason: the agent quit or crashed, or someone killed the session. It is started again `coordinator.restartDelaySeconds` (default 5) after that, so a coordinator that crashes at once does not start more often than once per delay.
3. A start first waits, up to `coordinator.exitWaitSeconds` (default 60), until the agent of the previous start has exited, so two never refresh the agent's credential at once (a refresh token is used once; the loser's login is lost). The previous agent is the pid `<home>/orchestration/coordinator.pid` names, with its start time from `ps`, so a pid reused by another process does not count, after a reboot for example.
4. Then `tmux new-session -d -s <session> -c <the folder arthur run runs in> -e ARTHUR_ORCHESTRATION_FOLDER=<home>/orchestration` starts `<agent> --continue --auto-approve [--model <coordinator.model>] [--thinking <coordinator.thinking>] [--smol <roles.quick.model>] -e <@arthur/core/env-guard> -e <the inbox extension> --append-system-prompt <the coordinator's role file>`: the last conversation goes on (a new one when there is none), nobody is there to approve tool calls, the env guard refuses a tool call naming a secrets file as it does in every job (see `arthur spawn --help`), and the inbox extension (`packages/orchestration/src/inbox-extension.ts`) hands the coordinator its messages (below). The role file is `packages/orchestration/roles/coordinator.md`.
5. At `arthur run`'s `stop` the session is killed.

Lines it prints in `arthur run`'s output:

- `orchestration: coordinator started: <agent> (pid <pid>) in tmux session <session>`.
- `orchestration: the coordinator ended; starting it again in <n> s`, or, after `arthur coordinator stop`, `orchestration: the coordinator ended; arthur coordinator stop asked, so it stays stopped until arthur run starts again`.
- `orchestration: the previous <agent> (pid <pid>) exited after <s> s`, when a start had to wait.
- `orchestration: coordinator start refused: the previous <agent> (pid <pid>) is still running <s> s later; trying again in <n> s`: the start is not made, and is tried again after the delay, waiting again, until the previous agent is gone.
- `orchestration: coordinator start failed: tmux new-session: <tmux's last line>; trying again in <n> s`, for tmux missing or refusing (the session name taken by another tmux server on that socket, for example).

## The coordinator's inbox

Every message for the coordinator becomes a turn of its conversation, and every turn's last reply goes back out:

- What reaches it: `message-received` `{ channel, text }`, the owner writing from a channel (an event without both as non-empty text is not queued: `orchestration: message-received (event <n>) ignored: expected { channel, text }, both non-empty text`); `coordinator-message` `{ text }`, from a plugin such as schedule (likewise checked); and `job-ended`, the wake: `Job <id> ended its run: <state> (<reason>).`, `Project: <project>.` when it is not the main one, the first 15 lines of the job's final message, and each line a plugin answers to `collect("coordinator.wake", <the job-ended data>)`, the procedure of its kind.
- Each one is a file `<home>/orchestration/inbox/queued/<event number>`, written by every process that gets the event (a command's and `arthur run`'s); one already in `queued/`, `turn/` or `answered/` is not written again, so an event delivered twice is one message.
- While the coordinator is idle, everything queued goes as one turn, in order, once the queue has not grown for 1 s; a turn holding no owner message is attributed to the agent, not the user.
- During a turn, the owner's messages join it: after the next tool call, together as one message delivered at omp's next step boundary without cutting the running tool batch (`deliverAs: "aside"`); after the last tool call, when the turn would end, the turn is resumed with them and told that its reply above was not sent, so it writes one reply that answers everything (omp's `session_stop` continuation, at most 8 in a turn; past that a message is the next turn). A job's end and a plugin's message never join a turn; they wait for the next one.
- Each message is one paragraph, marked: `[via <channel>]` or `[Arthur]`, then `sent during this turn`, `sent during this turn, after your last tool call`, `sent before a restart; no reply to it was sent`, or `sent before; its turn ended without a reply`. A turn with an `[Arthur]` message ends with the line `The lines marked [Arthur] come from Arthur (a job's end, a schedule), not from the owner.`
- A handed message moves to `inbox/turn/`. When the turn ends with a reply, its text goes to `<home>/orchestration/outbox/` as `{ text, answers: [event numbers], channels: [the channels of the owner messages it answers] }`, and only then do the turn's messages move to `inbox/answered/`. `arthur run` emits each reply as `coordinator-replied` `{ text, answers, channels }` within 500 ms, then moves it to `outbox/sent/`. A turn that ends in an error, aborted, or on a tool call answers nothing: its messages go again, marked.
- A hand-over omp refuses at once is tried again every 500 ms; the third failure in a row emits one `notice` `{ text: "the coordinator's inbox could not hand <n> message(s) to the agent 3 times in a row (<error>); it keeps trying every 0.5 s" }`. A hand-over that omp accepts and then fails shows its error in the coordinator's pane, and its messages wait in `inbox/turn/` until the coordinator restarts.
- At a restart of the coordinator, a message left in `inbox/turn/` that a reply in `outbox/` or `outbox/sent/` answers moves to `answered/`; every other one goes again as the first turn, marked `sent before a restart`. Files in `answered/` and `outbox/sent/` older than 7 days are deleted then.
- The footer of the coordinator's screen shows `arthur · <n> running: <short ids>` while jobs run, from the file `<home>/orchestration/footer` the plugin writes at each `job-started`, `job-state` and `job-ended`.
- The extension acts only in the coordinator's own session, one with a UI: never in a `task` subagent.

## arthur coordinator stop

Ends the coordinator's session and keeps it stopped until `arthur run` starts again (a restart of its service, for example). It writes the stop mark `<home>/orchestration/stopped` first, then kills the session, and prints `arthur coordinator stop: tmux session <session> (socket <socket>) ended; it stays stopped until arthur run starts again`, or `... was not running; ...` when no session ran (the mark still keeps it from being started).

Refused, exit code 1, while any job of any project is in a run (`working`, `idle`, or held `blocked`, as `arthur stopall` counts them): the coordinator is who hears a job's end, so nobody would. `arthur coordinator stop: refused: <n> jobs running: <id>, <id>; the coordinator is who hears their end; stop them first (arthur stop <id>, or arthur stopall)`. There is no force mode.

Wrong usage (no argument, another one, more than one) prints `usage: arthur coordinator stop` and exits 2.

## Options

In `orchestration({ ... })` in `arthur.config.ts`, every key optional; an unknown key or a wrong value refuses the start, naming its path:

- `maxAgents`: a whole number of at least 1, default 3.
- `coordinator`: `model` (a non-empty string), `thinking` (one of `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `auto`), `tmux: { session, socket }` (the session: letters, digits, `_` and `-`, since tmux reads `:` and `.` in a target; the socket: a non-empty string), `exitWaitSeconds` (a whole number of at least 0), `restartDelaySeconds` (a whole number of at least 1).
- `roles`: one entry per role, its name lowercase letters, digits and dashes, each `{ model, thinking }`: `model` a model name or a non-empty list of them, `thinking` as above. The entry `quick` is not a role: `{ model }` only, a model name.
- `plan: { budgetUsd }`, `autopilot: { budgetUsd, budgetMaxUsd }`: amounts in USD, 0 or more.
- `morningReport: { at }`: `"HH:MM"`, 00:00 to 23:59.

`plan`, `autopilot` and `morningReport` are checked here for their shape; the entries that read them say what they do.

## maxAgents and the models of each role

- `maxAgents` is the most jobs in a run at once (working, idle or held, as `arthur jobs` shows them), across every project and machine, every kind and every spawn, the human's `arthur spawn` and `arthur continue` included. A spawn or continue at the limit is refused before any worktree or record exists: `refused by orchestration: maxAgents is <n> and <count> jobs are in a run: <ids>; spawn again once one ends`. A job frees its slot the moment its state is `ended`, with no sweep. Two spawns at once, from one process or two, take turns from the checks to the record (the core's `<home>/spawn.lock`), so they never both take the last slot.
- Each role's `model` and `thinking` from `roles` go to the agent as `--model` and `--thinking`; `arthur spawn --model` and `--thinking` win over them. A role left out of `roles`, or without a `model` or `thinking`, uses the agent's own default for it. A `model` that is a list needs the models plugin (roadmap entry 82); until then such a role's spawn is refused: `roles.<role>.model: a model list needs the models plugin`.
- `roles.quick.model` is omp's quick model for titles, compaction and scout subtasks: `--smol <model>` on every job, whatever its role, and on the coordinator. Left out, nothing is added. A job keeps it through `arthur continue`; `arthur roles` shows it per role.
- A thinking level that is not one of omp's (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `auto`), from `--thinking`, is refused before any record exists: `refused by orchestration: thinking level "<value>" is not one of off, minimal, low, medium, high, xhigh, max, auto`. One in `roles` or `coordinator` refuses the start of `arthur run` instead.
