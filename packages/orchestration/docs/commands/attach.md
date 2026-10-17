# arthur attach

Usage: `arthur attach`. Comes with the `orchestration` plugin, which every config holds.

Attaches this terminal to the coordinator's tmux session, `coordinator.tmux.session` on socket `coordinator.tmux.socket` (see `arthur coordinator --help`), as `tmux attach-session` does: you talk to the coordinator as in any `omp` session. Detach with tmux's `Ctrl-b d`; the coordinator goes on. Quitting the agent ends the session, and `arthur run` starts it again after `coordinator.restartDelaySeconds`. Exits with tmux's exit code.

Refused, exit code 1, when no session runs: `arthur attach: no coordinator: tmux session <session> (socket <socket>) is not running; arthur run starts it`, or `...; arthur coordinator stop stopped it until arthur run starts again` after `arthur coordinator stop`.

Any argument prints `usage: arthur attach` and exits 2.
