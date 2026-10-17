# arthur coordinator

Usage: `arthur coordinator stop`. Comes with the `orchestration` plugin, which every config holds.

## The coordinator's process

The coordinator is one interactive agent (`core.agent.command`, `omp`) in its own tmux session, `coordinator.tmux.session` (default `arthur`) on its own tmux server, `coordinator.tmux.socket` (default `arthur`: a name, as `tmux -L arthur`; one with a `/` is a socket path, as `tmux -S <path>`). `arthur run` keeps it running from its `start` until its `stop`:

1. At `arthur run`'s start, a stop mark left by `arthur coordinator stop` is lifted. A session already running under that name (left by an `arthur run` that crashed) is kept, not started twice.
2. Every 500 ms it looks at the session. When the session is gone, or its agent exited and the pane stayed (a `remain-on-exit` in the human's `~/.tmux.conf`; the session is then killed), the coordinator has ended, for whatever reason: the agent quit or crashed, or someone killed the session. It is started again `coordinator.restartDelaySeconds` (default 5) after that, so a coordinator that crashes at once does not start more often than once per delay.
3. A start first waits, up to `coordinator.exitWaitSeconds` (default 60), until the agent of the previous start has exited, so two never refresh the agent's credential at once (a refresh token is used once; the loser's login is lost). The previous agent is the pid `<home>/orchestration/coordinator.pid` names, with its start time from `ps`, so a pid reused by another process does not count, after a reboot for example.
4. Then `tmux new-session -d -s <session> -c <the folder arthur run runs in>` starts `<agent> --continue --auto-approve [--model <coordinator.model>] [--thinking <coordinator.thinking>] -e <@arthur/core/env-guard> --append-system-prompt <the coordinator's role file>`: the last conversation goes on (a new one when there is none), nobody is there to approve tool calls, and the env guard refuses a tool call naming a secrets file as it does in every job (see `arthur spawn --help`). The role file is `packages/orchestration/roles/coordinator.md`.
5. At `arthur run`'s `stop` the session is killed.

Lines it prints in `arthur run`'s output:

- `orchestration: coordinator started: <agent> (pid <pid>) in tmux session <session>`.
- `orchestration: the coordinator ended; starting it again in <n> s`, or, after `arthur coordinator stop`, `orchestration: the coordinator ended; arthur coordinator stop asked, so it stays stopped until arthur run starts again`.
- `orchestration: the previous <agent> (pid <pid>) exited after <s> s`, when a start had to wait.
- `orchestration: coordinator start refused: the previous <agent> (pid <pid>) is still running <s> s later; trying again in <n> s`: the start is not made, and is tried again after the delay, waiting again, until the previous agent is gone.
- `orchestration: coordinator start failed: tmux new-session: <tmux's last line>; trying again in <n> s`, for tmux missing or refusing (the session name taken by another tmux server on that socket, for example).

## arthur coordinator stop

Ends the coordinator's session and keeps it stopped until `arthur run` starts again (a restart of its service, for example). It writes the stop mark `<home>/orchestration/stopped` first, then kills the session, and prints `arthur coordinator stop: tmux session <session> (socket <socket>) ended; it stays stopped until arthur run starts again`, or `... was not running; ...` when no session ran (the mark still keeps it from being started).

Refused, exit code 1, while any job of any project is in a run (`working`, `idle`, or held `blocked`, as `arthur stopall` counts them): the coordinator is who hears a job's end, so nobody would. `arthur coordinator stop: refused: <n> jobs running: <id>, <id>; the coordinator is who hears their end; stop them first (arthur stop <id>, or arthur stopall)`. There is no force mode.

Wrong usage (no argument, another one, more than one) prints `usage: arthur coordinator stop` and exits 2.

## Options

In `orchestration({ ... })` in `arthur.config.ts`, every key optional; an unknown key or a wrong value refuses the start, naming its path:

- `maxAgents`: a whole number of at least 1.
- `coordinator`: `model` (a non-empty string), `thinking` (one of `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `auto`), `tmux: { session, socket }` (the session: letters, digits, `_` and `-`, since tmux reads `:` and `.` in a target; the socket: a non-empty string), `exitWaitSeconds` (a whole number of at least 0), `restartDelaySeconds` (a whole number of at least 1).
- `roles`: one entry per role, its name lowercase letters, digits and dashes, each `{ model, thinking }`: `model` a model name or a non-empty list of them, `thinking` as above.
- `plan: { budgetUsd }`, `autopilot: { budgetUsd, budgetMaxUsd }`: amounts in USD, 0 or more.
- `morningReport: { at }`: `"HH:MM"`, 00:00 to 23:59.

`maxAgents`, `roles`, `plan`, `autopilot` and `morningReport` are checked here for their shape; the entries that read them say what they do.
