# arthur doctor

Usage: `arthur doctor`

Checks what Arthur needs to work, by code, without asking any model, and prints one line per requirement, the core's first, then each enabled plugin's in setup order:

```
core git: ok
core node: ok
core omp: ok
core home: ok
core controllers: missing: the user manager has the controllers "memory pids", not cpu and memory; without it: jobs run without the joint limit of core.jobs.cpu and core.jobs.memory, and what a job leaves behind is not killed at its end; fix: delegate them (docs/setup.md, step 10), then reboot
core env: ok
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
- `core home`: the home folder, `core.home`, exists or can be made, and is writable. Critical. The check makes it, or keeps it, its user's alone, whatever the umask: a new home is `0700`, one made earlier as `0755` loses the group's and others' bits; so does every command that loads the plugins, `arthur run` and every spawn. Every record, log, lock and plugin folder lies under it, so no other user of the host reads or writes them. A home of another user is `missing: <home> is not writable (EPERM)`.
- `core controllers`: the systemd user manager is there (`systemctl --user show-environment`) and the CPU and memory controllers are delegated to it (`systemctl show user@<uid>.service -p DelegateControllers`), so each job gets its scope (`arthur spawn --help`). Not critical. Without a user manager (macOS, a container) this is the one line that says so: `missing: no systemd user manager, so no job scope and no user service (<why>)`, and the session plugin then has no line.
- `core env`: the env file, `core.envFile`, lies outside the config's folder and outside each project's checkout, as the projects provider lists them (the config's folder alone when the plugins do not load). Not critical. Inside one, a recursive search the coordinator or a job runs there (`grep -r ARTHUR_ .`) prints its values into the agent's transcript, which the model provider keeps, and the env guard never sees the file's name: `missing: the env file <path> lies inside <folder>`, fixed by moving it to `~/.config/arthur/.env`, the default, and leaving `core.envFile` out of `arthur.config.ts`.
- `core provider key <variable>`: one line for each model provider's key that omp reads from its environment and that is set, not empty, in Arthur's own environment: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AZURE_OPENAI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`, `CEREBRAS_API_KEY`, `TOGETHER_API_KEY`, `FIREWORKS_API_KEY`, `PERPLEXITY_API_KEY`, `MOONSHOT_API_KEY`, `ZAI_API_KEY`, `MINIMAX_API_KEY`, `OLLAMA_API_KEY`, `LM_STUDIO_API_KEY`. None set, no line. Not critical. A job's launch drops only the `ARTHUR_` variables, so such a key exported in the shell or the service's environment reaches every job and each of its tool calls, where a program the job runs can read it: `missing: <variable> is set in Arthur's environment, which every job and each of its tool calls inherits`, fixed by unsetting it where `arthur run` starts and logging omp in with its own login (`omp login`, kept in `~/.omp`), or giving a job its key through the models plugin's `prepare` (`keyEnv`, `packages/models/docs/models.md`). The line names the variable, never its value.
- Each enabled plugin's own, in setup order: first what its `doctor` gives from its options alone, without its setup or its env values, then what its setup provides through `collect("doctor")`. From its `doctor`: `orchestration tmux` (`tmux -V` runs; critical, since there is no coordinator without it), `session service` and `session linger` (`docs/session.md`). From its setup, as they need what it reaches (a machine, a key, a clone): `machines <name>` (`arthur machines --help`), `projects <name> about` and `board` (`arthur projects --help`), `delivery <project> identity` (git has an author and a committer for a merge commit there, `arthur merge --help`), and those of `models` and `nvm`. A plugin disabled in the config is not checked and has no line.

A check that throws costs its own line only, `<plugin> <name>: missing: check failed: <error>`, and every other line is still printed; one that does not answer within 10 seconds is `missing: check timed out after 10 s`. A plugin whose answer is not a list of requirements, or throws, has one line, `<plugin> requirements: missing: check failed: <error>`.

A config that does not load prints `arthur doctor: arthur.config.ts did not load:` and the reasons, exit code 1. One that loads while the plugins do not (a variable missing, a refused option, a setup that failed) prints the core's own lines and each enabled plugin's `doctor` lines first, so a first setup sees those at once, then `arthur doctor: the requirements a plugin checks in its setup are not checked: arthur.config.ts did not load:` and the reasons, exit code 1.

## At every start of `arthur run`

The same check runs first, before the lock and before any plugin's `start`, so before the start notice's probe (`docs/session.md`). Each missing line is printed, `arthur run: <line>`, so the service's journal shows it.

- A critical one refuses the start: the missing lines go to stderr, then `arthur run: refused: a critical requirement is missing; fix each line above, then run arthur doctor`, exit code 1, and no plugin starts. They are sent as one `notice`, `arthur run refused on <host>: a critical requirement is missing` and the lines below it.
- Otherwise `arthur run` starts with reduced function, and the missing lines are sent as the core's `doctor` event, `{ lines }`, which the session plugin's start notice opens with. Without the session plugin they are printed only.

A line is sent at most once a day: `<home>/doctor.json` holds each missing line with when it was sent, so the service starting a refused `arthur run` again every 5 seconds sends its refusal once. A line that changed is a new line, sent at once; a line fixed is dropped from the file, so missing again it is sent again. A `doctor.json` that is not what Arthur writes (edited by hand) is taken as empty. With the home folder not writable nothing can record what was sent, so the lines are printed only; so are they when a plugin does not load, as there is no event log to send them to (a critical miss still refuses the start, else the load's own refusal does).

`arthur doctor` itself always prints every line, sent before or not, and sends nothing.
