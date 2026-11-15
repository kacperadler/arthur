# arthur attach

Usage: `arthur attach [<project>]`. Comes with the `orchestration` plugin, which every config holds.

Attaches this terminal to the coordinator's tmux session, `coordinator.tmux.session` on socket `coordinator.tmux.socket` (see `arthur coordinator --help`), as `tmux attach-session` does: you talk to the coordinator as in any `omp` session. Detach with tmux's `Ctrl-b d`; the coordinator goes on. Quitting the agent ends the session, and `arthur run` starts it again after `coordinator.restartDelaySeconds`. Exits with tmux's exit code.

With `<project>`, it attaches to that project's agent instead, its session `<coordinator.tmux.session>-<project>` on the same socket (`arthur coordinator --help`, "Project agents"), which goes on and starts again the same way.

Refused, exit code 1:

- When no session runs: `arthur attach: no coordinator: tmux session <session> (socket <socket>) is not running; arthur run starts it`, or `...; arthur coordinator stop stopped it until arthur run starts again` after `arthur coordinator stop`; for a project, `arthur attach: no agent of project <project>: tmux session <session> (socket <socket>) is not running; ...`, `arthur coordinator stop <project> stopped it ...` after that stop.
- A project without an agent: `arthur attach: project <name> has no agent (no orchestration.project({ chat }) in its project file); projects with one: <names, or none>`.

More than one argument prints `usage: arthur attach [<project>]` and exits 2.
