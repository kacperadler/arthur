# The herdr plugin

Roadmap entry 115: every job Arthur runs is a tab in [herdr](https://herdr.dev), the terminal workspace for coding agents, on the machine that runs `arthur run`. SSH to the server, open `herdr`, and the `arthur` workspace shows the coordinator in one tab and each job in a run in a tab of its own, streaming its run, with its state in herdr's sidebar, so you see at once which job waits for you. The jobs stay what they are: headless `omp` runs in their systemd scopes, with their guards and limits; a tab only shows one, through `arthur jobs --follow <id>` (`arthur jobs --help`), which reads the job's record. Nothing listens on a port: the plugin runs the `herdr` command, which talks to herdr's server on this machine over its socket.

```ts
plugins: [orchestration({}), herdr()],
```

It has no options but `enabled`; any other is refused at load (`herdr.<key>: unknown option; herdr has no options but enabled`).

## Setting it up on the server

1. herdr 0.9.3 in `~/.local/bin`, which is on the service's `PATH` (`docs/setup.md`, step 8). **Check:** `herdr --version` prints `herdr 0.9.3`.
2. herdr's server kept running, so `arthur run`, a systemd service, finds it. `herdr` starts its server when you open it; for one that runs from boot on, a user unit, as `arthur.service` is kept [not yet checked on the server: herdr documents `herdr server`, "Run as headless server", and the unit below is written from it]:

   ```sh
   cat > ~/.config/systemd/user/herdr.service <<'EOF'
   [Unit]
   Description=herdr server
   [Service]
   ExecStart=%h/.local/bin/herdr server
   Restart=always
   [Install]
   WantedBy=default.target
   EOF
   systemctl --user daemon-reload && systemctl --user enable --now herdr.service
   ```

   **Check:** `herdr workspace list` prints `{"id":…,"result":{"type":"workspace_list",…}}`.
3. `arthur` on the `PATH` of your interactive shells (`docs/setup.md`, step 4): each tab types its command into a shell herdr started, which finds `arthur` there. A miss shows in the tab as `arthur: command not found`.
4. `herdr()` in the plugin list of `arthur.config.ts`, then restart the service: `systemctl --user restart arthur`. **Check:** `arthur doctor` prints `herdr herdr: ok`.

## The workspace and its tabs

At its start, `arthur run` finds the herdr workspace labelled `arthur`, or makes it in the folder of `arthur.config.ts`, without taking the focus:

- `coordinator`, its first tab, runs `while :; do arthur attach; sleep 5; done`: it attaches to the coordinator again 5 s after each detach or restart. Close it and the next start of `arthur run` opens it again.
- One tab per job in a run, labelled `<ticket> <kind> <short id>`, such as `AR0670 worker 436045b4` (`worker 436045b4` for a job on no ticket), running `arthur jobs --follow <id>`: the job's log from its first line, each tool call with its path, command or pattern, the agent's text as `> ` lines, its state as `state: <state> (<reason>)` lines, until its run ends. Then the tab stays with what it printed.
- A job whose run starts again (`arthur continue`) gets a new tab; its old one is closed first. `arthur prune` closes the job's tab, also from a process that is not `arthur run`; a prune never makes the workspace.
- At each start of `arthur run`, every job in a run gets a new tab, the old one closed, so a restart costs the tab's scroll position; an ended job that still has a tab gets its state reported.

The plugin acts only in `arthur run`, once it started: another `arthur` command, `arthur spawn` too, opens no tab; `arthur run` hears that job start in the event log and opens it.

## What each state means in herdr's sidebar

The plugin reports each job's state to its tab as agent `arthur` (`herdr pane report-agent`); herdr 0.9.3 takes `idle`, `working`, `blocked` and `unknown`:

| Job state | herdr state | Message |
| --- | --- | --- |
| `working` | `working` | none |
| `idle` (no output for `core.jobs.idleMinutes`) | `working` | `idle` |
| `blocked` | `blocked` | its reason, such as `user: may I drop the old table?` |
herdr not installed, its server not running, or a call refused or not answered within 5 s: the plugin gives up on that call and what followed it for that event, says nothing, and never holds up a spawn or `arthur run`'s start. `arthur doctor` says it, one line, never critical, and `arthur run` puts it first in its start notice, at most once a day (`arthur doctor --help`):

`blocked` is the one that needs you: a question to answer (`user: ...`) or something to unblock (`dependency: ...`). An ended job shows as done until you have looked at its tab, then as idle, as herdr tells a done agent from an idle one by whether its tab was seen [herdr's own description, not yet checked on the server].

## When herdr is missing

herdr not installed, its server not running, or a call refused or not answered within 5 s: the plugin gives up on that call and what followed it for that event, says nothing, and never holds up a spawn or `arthur run`'s start. `arthur doctor` says it, one line, never critical, and `arthur run`'s start sends it as a notice at most once a day:

```
herdr herdr: missing: herdr not found on PATH
herdr herdr: missing: herdr workspace list: Error: Os { code: 2, kind: NotFound, message: "No such file or directory" }
herdr herdr: missing: herdr workspace list did not answer in 5 s
```

The second is a herdr without its server (step 2 above). A herdr started after `arthur run` gets the workspace and the coordinator's tab at the next job's start, and a tab for every job in a run at the next start of `arthur run`.

## Other machines

A job on another machine gets its tab here too: the sweep of `arthur run` copies its record from there every 30 s, and `arthur jobs --follow` follows that copy. herdr's `--machine`, which reaches a herdr on another machine, is not used.
