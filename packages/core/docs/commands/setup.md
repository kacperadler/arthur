# arthur setup

Usage: `arthur setup`

A report of what is there, what is set and what is missing, in the folder that holds `arthur.config.ts`; run it on a new machine, and again after each fix. It installs nothing, runs no model, prints no variable's value, and writes nothing beyond what `arthur doctor` does (the home folder, and each plugin's folder in it, which the load every command runs makes). Its sections, in this order:

```
Tools
  git          2.43.0         core
  node         v24.21.0       core
  omp          omp/18.3.0     core
  ssh          OpenSSH_9.6p1  core
  systemd-run  255            core
  tailscale    not found      core
  tmux         3.4            orchestration
  docker       27.3.1         docker (not in the config)

Config: arthur.config.ts
  core           set: home, jobs.budgetUsd; not set: envFile, agent, timeZone, quietHours, jobs.timeoutMinutes, ...
  orchestration  on   set: maxAgents, coordinator.model; not set: coordinator.thinking, roles, plan, ...
  projects       on   set: list (2); not set: reposDir
  telegram       on   set: bots (1), media
                      env set     ARTHUR_TELEGRAM_BOT_TOKEN (telegram.bots[0].botTokenEnv)
                      env missing ARTHUR_TELEGRAM_CHAT_ID (telegram.bots[0].chatIdEnv)
  session        off (enabled: false)

Requirements (arthur doctor)
  core git: ok
  ...
  orchestration tmux: ok
  the requirements a plugin checks in its setup are not checked until what Config refuses is fixed

Can still go in arthur.config.ts
  session (off): the coordinator's conversation: compacted by day, fresh each night, restarts, the restart guard and the LLM probe
    compactAt  When the coordinator's conversation is compacted, once it is idle; [] for never; default ["08:00", "13:00", "18:00"]
    ...
  docker (not in the config): labels and removes the Docker resources of each job
    ...

Next
  1. Set ARTHUR_TELEGRAM_CHAT_ID in /home/<user>/.config/arthur/.env (telegram.bots[0].chatIdEnv), then arthur config check. Refuses the start.
  2. delegate them (docs/setup.md, step 10), then reboot
Run arthur setup again after each step.
```

The plugins are the packages installed beside the config, `node_modules/@arthur/<name>`: each one's options file (`@arthur/<name>/options`: a one-line summary, every option with its meaning and default, the tools it runs) is read by its path, so a plugin installed but not in the config is shown too. A package without one is named, `no options table`, and every other plugin is still listed. A plugin that is planned but not built has no package, so it is not listed; `spec/roadmap.md` names it.

- **Tools**: each tool the core and every installed plugin run, its version, and which plugins use it, `(off)` when the config lists a plugin with `enabled: false`, `(not in the config)` when it does not list it. The version is the first word with a digit in the first line its version command prints, that line when none has one; `not found` when the command is not on `PATH`; `no version: <its last line>` when it fails, `no version: it printed nothing`, and `no version: cut after 5 s` when it does not end within 5 seconds. Every command runs at once, and a tool's line costs only that line.
- **Config**: the core, then each plugin the config lists, `on` or `off (enabled: false)`. For each one that is on, the options its table has, `set` and `not set` (a nested object's fields by their path once it is set, a list with its length), and its env variables as `arthur config check` prints them, `set` or `missing`, never a value. A plugin without an options table shows the options the config gives it. A plugin that is off has its env not read. Below, each refusal of `arthur config check` (`refused: <line>`), or, when it has none, why the plugins did not load, and the env file's warnings.
- **Requirements**: `arthur doctor`'s lines, from the same check (`arthur doctor --help`). When the plugins did not load (a variable missing, a refused option, a setup that failed), the core's own lines and each enabled plugin's own `doctor`, which needs neither its setup nor its env values (`orchestration tmux`, `session service`, `session linger`), then `the requirements a plugin checks in its setup are not checked until what Config refuses is fixed`: those of `machines`, `models`, `nvm` and `projects`, which need what their setup reaches (a machine, a key, a clone).
- **Can still go in arthur.config.ts**: each installed plugin that is off or not in the config, with its summary, and every option at any depth (`*` for each item of a list or record) with its meaning, and its default when it has one; `nothing` when there is none.
- **Next**: numbered steps, each with its fix, in this order: the config (`Fix what Config refuses above, then arthur config check`), each missing env variable (`Set <name> in <env file> (<option>), then arthur config check`), each critical requirement missing, then every other requirement missing; a step that refuses `arthur run` ends `Refuses the start.`; and the closing line `Run arthur setup again after each step.` With nothing to do it says `nothing`.

Exit code 1 when a step in Next refuses `arthur run` (a config or env refusal, a critical requirement missing), else 0; 2 on wrong usage (`usage: arthur setup`).

- No `arthur.config.ts`: Config says `Config: no arthur.config.ts`, Requirements `skipped: no arthur.config.ts`, every installed plugin is `(not in the config)` and can go in, and the first step is `Write arthur.config.ts (docs/setup.md, step 5), then arthur config check`.
- A config that does not load: its refusal under Config, Requirements and Can still go `skipped: arthur.config.ts does not load`, no plugin marked in Tools, exit 1.
