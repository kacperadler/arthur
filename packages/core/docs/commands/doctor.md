# arthur doctor

Usage: `arthur doctor`

Checks what Arthur needs to work, by code, without asking any model, and prints one line per requirement, the core's first, then each enabled plugin's in setup order:

```
core git: ok
core node: ok
core omp: ok
core home: ok
core controllers: missing: the user manager has the controllers "memory pids", not cpu and memory; without it: jobs run without the joint limit of core.jobs.cpu and core.jobs.memory, and what a job leaves behind is not killed at its end; fix: delegate them (docs/setup.md, step 10), then reboot
orchestration tmux: ok
session service: ok
session linger: ok
machines mac: ok (macos arm64, arthur 3f9c2a1b7d4e)
projects blog about: missing: no about; without it: the coordinator knows it only by prefix, name and title; fix: add about to project blog in arthur.config.ts
```

Each line is `<plugin> <name>: ok` (some add what they found in brackets), or `<plugin> <name>: missing: <reason>; without it: <what does not work>; fix: <one command or step>`. Every check runs at once, each cut after 10 seconds. Exit code 1 when a critical requirement is missing, else 0, also with other lines missing; 2 on wrong usage (`usage: arthur doctor`).

## What is checked

- `core git`: `git --version` runs. Critical.
- `core node`: the Node that runs `arthur` is 24 or newer. Critical.
- `core <agent>`: the agent binary, `core.agent.command` (default `omp`), is found on `PATH`; it is not run. Critical.
- `core home`: the home folder, `core.home`, exists or can be made, and is writable. Critical.
- `core controllers`: the systemd user manager is there (`systemctl --user show-environment`) and the CPU and memory controllers are delegated to it (`systemctl show user@<uid>.service -p DelegateControllers`), so each job gets its scope (`arthur spawn --help`). Not critical. Without a user manager (macOS, a container) this is the one line that says so: `missing: no systemd user manager, so no job scope and no user service (<why>)`, and the session plugin then has no line.
- Each enabled plugin's own, in setup order: first what its `doctor` gives from its options alone, without its setup or its env values, then what its setup provides through `collect("doctor")`. From its `doctor`: `orchestration tmux` (`tmux -V` runs; critical, since there is no coordinator without it), `session service` and `session linger` (`docs/session.md`). From its setup, as they need what it reaches (a machine, a key, a clone): `machines <name>` (`arthur machines --help`), `projects <name> about` and `board` (`arthur projects --help`), and those of `models` and `nvm`. A plugin disabled in the config is not checked and has no line.

A check that throws costs its own line only, `<plugin> <name>: missing: check failed: <error>`, and every other line is still printed; one that does not answer within 10 seconds is `missing: check timed out after 10 s`. A plugin whose answer is not a list of requirements, or throws, has one line, `<plugin> requirements: missing: check failed: <error>`.

A config that does not load prints `arthur doctor: arthur.config.ts did not load:` and the reasons, exit code 1. One that loads while the plugins do not (a variable missing, a refused option, a setup that failed) prints the core's own lines and each enabled plugin's `doctor` lines first, so a first setup sees those at once, then `arthur doctor: the requirements a plugin checks in its setup are not checked: arthur.config.ts did not load:` and the reasons, exit code 1.

## At every start of `arthur run`

The same check runs first, before the lock and before any plugin's `start`, so before the start notice's probe (`docs/session.md`). Each missing line is printed, `arthur run: <line>`, so the service's journal shows it.

- A critical one refuses the start: the missing lines go to stderr, then `arthur run: refused: a critical requirement is missing; fix each line above, then run arthur doctor`, exit code 1, and no plugin starts. They are sent as one `notice`, `arthur run refused on <host>: a critical requirement is missing` and the lines below it.
- Otherwise `arthur run` starts with reduced function, and the missing lines are sent as the core's `doctor` event, `{ lines }`, which the session plugin's start notice opens with. Without the session plugin they are printed only.

A line is sent at most once a day: `<home>/doctor.json` holds each missing line with when it was sent, so the service starting a refused `arthur run` again every 5 seconds sends its refusal once. A line that changed is a new line, sent at once; a line fixed is dropped from the file, so missing again it is sent again. A `doctor.json` that is not what Arthur writes (edited by hand) is taken as empty. With the home folder not writable nothing can record what was sent, so the lines are printed only; so are they when a plugin does not load, as there is no event log to send them to (a critical miss still refuses the start, else the load's own refusal does).

`arthur doctor` itself always prints every line, sent before or not, and sends nothing.
