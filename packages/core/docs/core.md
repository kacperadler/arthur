# The core

The core is always on and does no directing of its own: it loads `arthur.config.ts`, checks every plugin's options and resolves each `...Env` name against the environment; it is the plugin host, the command registry and the terminal (`arthur <command>`); it runs each job in its own worktree on its own branch, here or on another machine over SSH, with its limits (time, money, and CPU and memory in one joint slice), its state, stop, continue and steer; it keeps the ticket board, changed only through its own command; it builds each role's prompt, emits an event for every state change, and keeps the clock every plugin reads (`timeZone`, `quietHours`). In every job its env guard keeps the env file from the agent, and its worktree guard refuses a write into the main checkout, the home folder or another job's worktree. The fake host and fake agent every plugin is tested against are published as `@arthur/core/testing`.

```ts
export default defineConfig({
	core: { timeZone: "Europe/Warsaw", jobs: { timeoutMinutes: 120, budgetUsd: 2 } },
	plugins: [orchestration({})],
});
```

## Options

In `core: { ... }` of `arthur.config.ts`; each may be left out. An unknown option, a wrong type or value refuses the start.

- `home`: Arthur's home folder: job records, the event log, each plugin's state; relative to the config's folder. Default `.arthur`.
- `envFile`: the file of env values the config's `...Env` options name, outside every folder an agent works in. Default `~/.config/arthur/.env` (`$XDG_CONFIG_HOME/arthur/.env` when that is set).
- `agent.command`: the coding agent's binary, which every job and the coordinator run. Default `omp`.
- `timeZone`: the time zone of every time of day in the config, and of the clock every plugin shares. Default the system's.
- `quietHours`: `{ from, to }`, each `"HH:MM"`: channels send without a notification from `from` up to `to`, across midnight when `from` is later; equal, never quiet. Default no quiet hours.
- `jobs.timeoutMinutes`: minutes a job may run before it is stopped, 0 for no limit. Default 120.
- `jobs.budgetUsd`: USD a job may spend before it is stopped, 0 for no limit. Default 2.
- `jobs.idleMinutes`: minutes without output or a tool call after which a running job is `idle`, 0 for never. Default 10.
- `jobs.cpu`: the cores all jobs together may use, in one systemd slice. Default the machine's cores less one, at least 1.
- `jobs.memory`: the memory all jobs together may use, as systemd's `MemoryMax`. Default `70%`.
- `jobs.offlineGraceMinutes`: minutes a job stays `blocked` once its machine stops answering, then it fails; 0 fails it at once. Default 30.
- `jobs.unsandboxed`: `true` lets a job run where its sandbox cannot be set up (macOS, no `python3`, a kernel without Landlock), its install and agent with the writes of Arthur's user; `false` ends such a job `failed: no sandbox: <why>; set core.jobs.unsandboxed: true ...` before anything of it starts (`arthur spawn --help`, "The sandbox"). Default `false`.

`arthur config check` checks the config and lists every variable it names, `arthur doctor` checks what Arthur needs on this machine, and `arthur setup` reports what is there, set and missing on a new one. Each command's page, what `arthur <command> --help` prints, is in [`commands/`](commands/).
