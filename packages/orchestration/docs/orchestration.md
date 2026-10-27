# The orchestration plugin

The coordinator: one interactive `omp` in its own tmux session, started again whenever it ends, which directs every project and the work across them; the human talks to it through a channel or joins its session with `arthur attach`. It is always loaded: Arthur refuses to start without it, and refuses `enabled: false` on it. It wakes the coordinator when a job ends, gives it its inbox and context each turn, and holds `/board` and `/task`, the planning of large tickets, autopilot, the decision log, silent mode and the morning report.

```ts
plugins: [
	orchestration({
		maxAgents: 3,
		coordinator: { model: "anthropic/claude-opus-5-5", thinking: "high" },
		roles: { reviewer: { model: "anthropic/claude-sonnet-5", thinking: "medium" } },
		morningReport: { at: "08:00" },
	}),
],
```

## Options

- `maxAgents`: jobs in a run at once, across every project and machine, the human's spawns included. Default 3.
- `coordinator`: the coordinator's `model` and `thinking` (default the agent's own); `tmux.session` and `tmux.socket`, where it runs and `arthur attach` joins (default `arthur` each; a socket with a `/` is a path, in a folder only Arthur's user may enter); `exitWaitSeconds`, how long to wait for the previous coordinator to exit, so two never refresh the OAuth token at once (default 60); `restartDelaySeconds`, how long after it ended it starts again (default 5).
- `roles`: each role's `model` and `thinking` by role name (worker, reviewer, planner, ...); a `model` may be an ordered list, the first available at the job's start used. `roles.quick.model` is not a role: omp's quick model for every job and the coordinator.
- `mcp`: MCP servers defined once by name in `servers`, each `{ command, args?, env? }` or `{ url, headers? }`, a secret as `{ valueEnv }`; `all`, the servers every role gets; `roles`, a role's own list, which replaces `all` for it.
- `plan.budgetUsd`: a plan job's budget in USD; it resumes once at it, doubled. Default 5.
- `autopilot.budgetUsd`, `autopilot.budgetMaxUsd`: a ticket set planned by policy, its worker's budget unless `--budget` or the ticket gives one (default 1), and the most `--budget` may give (default 3).
- `morningReport.at`: when the morning report, a schedule entry, is sent, in `core.timeZone`.

Each command's page, what `arthur <command> --help` prints, is in [`commands/`](commands/); `arthur coordinator --help` holds the coordinator's process, its context and its options.
