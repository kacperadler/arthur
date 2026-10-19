# AR0180 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. While a variable is missing, the machines' SSH checks and the projects' about and board lines still wait for the setup

- Kind: improvement
- Found by: 2026-10-19-ar0177-options-doctor-ba-804540bb (worker), 2026-10-19
- Where: `packages/machines/src/machines.ts:80` (`provide("doctor")`, each check through `checkMachine(host, ...)`, `host.jobs.run`), `packages/projects/src/projects.ts:54` (`requirements` over each project's folder, which `projectFolder` clones at setup)
- What: AR0180 gives a plugin an own `doctor` (options and the core's, no host), which `arthur doctor`, `arthur setup` and a refused `arthur run` check while the load refuses; orchestration's `tmux` and session's `service` and `linger` moved into it. The machines' lines (`ssh` to each machine, `local`'s tools) run through the core's job runner, which knows a machine only once the plugin's setup registered it, and the projects' `board` line reads the project's folder, which the setup clones for a `repo` project; so with `ARTHUR_TELEGRAM_CHAT_ID` missing, a first setup still sees neither an unreachable machine nor a project without an about. Models (the providers' keys are env values) and nvm (the machines other plugins registered) need the setup by their nature. Reproduce: a config with `machines({ list: [<one machine>] })` and a Telegram variable unset; `arthur doctor` prints no `machines <name>` line.
- Suggestion: a `doctor` for projects with the `about` lines (options only) and the `board` line of a `path` project; for machines, a check over `ssh <host>` that needs no registered machine (the address check of `publicAddress` and `arthur version`), shared with the setup's round so the two never differ. Out: running a plugin's setup with a variable missing (AR0180's Out).
- Status: dropped (the coordinator accepted it on 2026-10-19: these checks need their plugin's setup, and show once the variable is set)
