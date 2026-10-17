# AR0107 - Plan

- Job: 2026-10-17-plan-ticket-spec-feature-2c6083da
- Planned at: a622f3d0b9e1b53d652a6f7b12fe82eed5fed391

## Approach
This ticket writes a guide and plans a command. It adds no code. `npm run check` and `npm test` pass at HEAD (tsc clean, 357 tests passing), and this ticket only changes docs and the roadmap.

**1. The guide, `docs/setup.md`.**
- `docs/deploy.md` already holds most of the install: steps 1–6 cover Node, git, tmux, OMP, the clone, the config, `.env`, the service `PATH`, the systemd service and `arthur doctor`.
- Those steps move into the new `docs/setup.md`, so there are not two copies. `docs/deploy.md` keeps the rest: another machine for jobs, the threat model, daily use and updating. Its intro points to `setup.md` for the install.
- Each step ends with **Check:**, the command that proves the step is done and what it prints. A step that is not built yet says `Not built yet (roadmap entry N)` and gives the manual way for today.
- The steps:
  1. **A user for Arthur, not root.** Check: `id -un`, `sudo true`.
  2. **Node 24, git, tmux and OMP.** Uses the check-then-install lines that `deploy.md` already has. Check: `node --version` (v24 or newer), `git --version`, `tmux -V`, `omp --version`.
  3. **`omp login`**, with the SSH tunnel note. Check: `omp usage` lists the account. [INFERENCE] from `omp --help`: "Show provider usage limits for every authenticated account".
  4. **The clone, `npm ci`, and `PATH`.** Check: `arthur version`.
  5. **`arthur.config.ts`.** Use the two plugins that are built (the README's "Try it" config), not a copy of `arthur.config.example.ts`. Its first lines say the `@arthur/*` packages it imports do not exist yet, so a copied example would not load [INFERENCE, not run]. Check: `arthur config check` exits 0, and `arthur projects` lists the project.
  6. **`.env`.** Check: every line of `arthur config check` says `set`, and `stat -c %a .env` prints `600`.
  7. **The project's board.** Today the first `arthur ticket new` creates it, because a missing board file reads as an empty board (`board-file.ts`). `arthur init` is not built yet (entry 42). Check: `arthur board`.
  8. **The service's `PATH`.** Check: `env -i "$(cat ~/.config/arthur.env)" sh -c 'node --version && omp --version'`. I ran the same form here and it printed both versions.
  9. **The service, linger and the restart drop-in.** Check:
     - `systemctl --user is-active arthur` prints `active`;
     - `loginctl show-user "$USER" -p Linger` prints `Linger=yes` (ran here);
     - `systemctl show "user@$(id -u)" -p Restart` prints `Restart=always`;
     - the journal shows `arthur run: pid … started`.
  10. **CPU and memory controllers delegated.** Check: `cgroup.controllers` lists `cpu` and `memory`.
  11. **The coordinator.** Check: `arthur attach` (built, entry 23).
  12. **A channel.** Telegram is not built yet (entries 47–50); until then there is the terminal only.
  13. **`arthur doctor`.** Not built yet (entry 80).
  14. **`arthur setup`.** Not built yet (entry 94). It will run the checks above in one command.

**2. `arthur setup` goes on the roadmap as two new entries.** Numbers 85–92 are taken by AR0098's approved plan, so these are 93 and 94. Both sit right after 80.

**Entry 93: option tables (half a day).**
- Every option the core and each plugin accept gets a table entry: either `{ about, check }`, or `{ about, fields }` for a nested object. `about` is a one-line meaning.
- The plugin's own check walks that same table, so an option without its meaning cannot exist. That is how the list never drifts from the code.
- This is the third table of the same shape, so the core can publish the type:
  - the core's `SHAPE` in `config.ts`;
  - orchestration's `FIELDS` in `orchestration-options.ts`;
  - projects' `FIELDS` in `project-options.ts`.
- Each plugin's options file also exports:
  - a one-line `summary`;
  - `tools`, each `{ name, version: argv }`. The core names git, node, omp, ssh and systemd-run; orchestration names tmux.
- Each plugin package publishes this file as `@arthur/<plugin>/options`.

**Entry 94: `arthur setup` (a day, in the core).**
- It is a report you run again after each fix. It writes nothing, installs nothing, never runs a model, and never prints a variable's value.
- It finds the installed plugins by listing `node_modules/@arthur/*` from the config's folder. It loads each package's `./options` by path, the way the core already loads `arthur.config.ts`.
- Its sections, in this order:
  1. **Tools**: version, or `not found`, and which plugins use it.
  2. **Config**: the core, then each listed plugin `on` or `off`. For each one that is on: options `set` and `not set`, and its env lines as `arthur config check` prints them.
  3. **Requirements**: `arthur doctor`'s lines, from the same function.
  4. **Can still go in arthur.config.ts**: each installed plugin that is off or not listed, with its summary and every option's meaning.
  5. **Next**: numbered steps, each with its fix, in this order: config, then env, then critical requirements, then the rest.
- Exit code: 1 when something in Next would refuse `arthur run`, else 0.
- Plugins that are planned but not built have no code to read, so they are not listed; the roadmap names them.

**Changes to existing roadmap entries:**
- **80**: orchestration adds a `tmux` requirement (critical: there is no coordinator without it), and the core adds "controllers delegated" (not critical). One sentence says `arthur setup` prints the same lines.
- **42**: adds a non-critical requirement per project, `<project> board: missing: no spec/build.json; fix: arthur init <project>`, so Next walks a new owner to `arthur init`.
- **51**: the frozen API includes the `./options` export.
- **The "Every entry also means" line**: each option an entry adds has its meaning in its table, and each binary it runs is in `tools`.
- **The Order paragraph** says where 93 and 94 sit and why.
- **Coverage row S8** adds 94 and `docs/setup.md`.

**One example run.** It is illustrative: it shows a point after telegram (47) and voice (81) exist. Their option names are the example config's proposals.
```
$ arthur setup
Tools
  git          2.43.0          core
  node         v24.21.0        core
  omp          omp/18.3.0      core
  ssh          OpenSSH_9.6p1   core
  tmux         3.4             orchestration
  ffmpeg       not found       telegram, voice (off)
  whisper-cli  not found       voice (off)
  docker       27.3.1          docker (not in the config)

Config: arthur.config.ts
  core           set: home, jobs.budgetUsd; not set: envFile, agent, timeZone, quietHours, jobs.timeoutMinutes, …
  orchestration  on   set: maxAgents, coordinator.model; not set: coordinator.tmux, roles, plan, autopilot, morningReport, …
  projects       on   set: list (2 projects), reposDir
  telegram       on   set: bots (1), media
                      env set     ARTHUR_TELEGRAM_BOT_TOKEN (telegram.bots[0].botTokenEnv)
                      env missing ARTHUR_TELEGRAM_CHAT_ID (telegram.bots[0].chatIdEnv)
  voice          off (enabled: false)

Requirements (arthur doctor)
  core git: ok
  core omp: ok
  orchestration tmux: ok
  telegram ffmpeg: missing: not found; without it: the videos you send reach the coordinator as files; fix: sudo apt-get install -y ffmpeg
  projects shop board: missing: no spec/build.json; without it: no tickets for shop; fix: arthur init shop

Can still go in arthur.config.ts
  voice (off): local transcription of voice notes with whisper.cpp
    model           a whisper.cpp model name, or a path to a .bin file; default "small"
    threads         CPU threads whisper uses; default 4
    language        a language code, or "auto"; default "pl"
    timeoutSeconds  a longer transcription is cut; default 300
    maxSeconds      a longer note is not transcribed; default 600
  docker (not in the config): labels and removes the Docker resources of each job
    buildCache      the cap of Docker's build cache
    leftoverHours   unlabelled leftovers older than this are swept
    sweep.at        the daily sweep, "HH:MM"

Next
  1. Set ARTHUR_TELEGRAM_CHAT_ID in .env (telegram.bots[0].chatIdEnv), then arthur config check. Refuses the start.
  2. sudo apt-get install -y ffmpeg
  3. arthur init shop
Run arthur setup again after each step.
```

**Left alone:** all code, the vision, the site page (AR0105), the CHANGELOG (it is generated), and `job-machine.ts` with `spawn.md`. Those last two point to the "Another machine" section, which stays in `deploy.md`.

## Not available directly
- **What is missing.** The owner wants every option a plugin takes, with a one-line meaning, "read from the plugins' own option checks". Today a plugin's options can only be checked, not listed:
  - `Plugin.check` is a function that returns problems (`packages/core/src/plugin.ts`, lines 25–26);
  - the `FIELDS` tables in `orchestration-options.ts` and `project-options.ts` hold checks with no meanings;
  - the core sees only the plugins the config lists (`cli.ts`, `load()` → `loadConfig` → `loadPlugins`), so an installed plugin that is not in the config cannot be shown.
- Option 1: each option's meaning sits beside its check in the table, and each plugin package publishes that table as `@arthur/<plugin>/options`; `setup` lists installed `@arthur/*` packages and loads each one by path. Cost: about 15–20 lines per plugin, plus the core's walker. Risk: loading plugin files by path at run time bends "the core imports no plugin". There is no static import, so the structure test stays green; entry 94's text says this so the reviewer judges it.
- Option 2: a table field on the `Plugin` object, read only from the plugins the config lists. Cost: lower. Risk: an installed plugin missing from the config is invisible, which misses "every plugin not yet enabled" unless the owner lists it with `enabled: false`.
- Option 3: read the meanings from the doc pages' "Options" sections or from the comments in `arthur.config.example.ts`. Cost: a Markdown parser, which the styleguide forbids. Risk: the list drifts from the code.
- Recommendation: Option 1. Entries 93 and 94 above follow it.

## Files
- `docs/setup.md` (new): the 14 steps above, each with its Check, and "Not built yet (entry N)" where it applies.
- `docs/deploy.md`: steps 1–6 move out. The intro links to `setup.md`. The "as in step N" references under "Another machine for jobs" point to the matching steps in `setup.md`. Other machines, the threat model, daily use and updating stay.
- `spec/roadmap.md`:
  - new entries 93 and 94 after 80, each with Package, Delivers, Done means, Depends on (93: 23, 41; 94: 93, 80), Size and Covers (S8), written as above;
  - the edits to 80, 42 and 51, the "Every entry also means" line, and the Order paragraph;
  - the `deploy.md` references in entry 8, entry 84 ("step 4" becomes the service `PATH` step of `setup.md`) and the switch paragraph (line 785) become `docs/setup.md`;
  - coverage row S8.
- `README.md`:
  - a Features row: "Core: `arthur setup`, and every option's meaning beside its check | planned | 93, 94";
  - "Try it" and "Read more" link `docs/setup.md` for the install, and `deploy.md` for other machines and the threat model;
  - the mermaid copy matches `arthur.mmd`.
- `arthur.mmd`: the "later in the core" label adds `setup`.
- `packages/core/docs/commands/run.md`: the service pointer becomes `docs/setup.md`.
- `packages/projects/docs/commands/projects.md`: the service `PATH` pointer becomes `docs/setup.md`.

## Risks
- **Broken links or step numbers after the split.** The worker greps `deploy.md` and `step [0-9]` across the repository and fixes every hit that pointed at a moved step. `job-machine.ts` and `spawn.md` keep pointing at the "Another machine" section, which stays, so no code or test changes.
- **The guide promises commands that do not exist.** Every unbuilt step carries "Not built yet (entry N)" and the manual check for today. The guide never says to copy the example config.
- **Roadmap number clash.** AR0098 reserves 85–92, so this plan uses 93 and 94.
- **The diagram copy test fails.** `test/structure.test.ts` keeps the README's mermaid block equal to `arthur.mmd`, so both files are edited together.
- **Later line budgets.** Entries 93 and 94 add lines to the core, orchestration and projects (the core has about 196 lines of room today: 4517 of 4713). Any raise is recorded in those entries' tickets, as the structure test requires. Nothing changes in this ticket.
- **A secret leaks through `arthur setup`.** Entry 94's Done means requires a test with a known value set in the shell and in `.env` that is absent from the output. The env lines come from `checkEnv`, which prints no values.

## How to test
- **The setup guide:** the worker runs each step's Check on the build machine where it can, and records what printed:
  - `node --version`, `git --version`, `tmux -V`, `omp --version`;
  - `node packages/core/src/cli.ts version`;
  - `arthur config check` and `arthur projects` on the README config in a temporary folder;
  - the `env -i` `PATH` check and `loginctl … Linger`.

  Steps that change the system (`adduser`, installing the service) are checked by reading them against the moved `deploy.md` text: nothing dropped, every unbuilt step marked.
- **No dangling references:** a grep for `deploy.md` and `step [0-9]` shows every remaining reference points at a section that still exists.
- **The `arthur setup` proposal and its order:**
  - `grep -n '^### 9[34]\.' spec/roadmap.md` shows both entries right after 80;
  - entries 80, 42 and 51, the "Every entry also means" line, the Order paragraph and row S8 carry the edits above;
  - the example run is in the plan and in entry 94's Delivers.
- **`npm test` and `npm run check` pass.** Both pass at HEAD. Re-run after the edits; the mermaid-copy and README status tests cover the files touched.

## Open questions
- The ticket's Scope names only "the plan; `docs/setup.md`". I recommend this ticket also writes the new roadmap entries 93 and 94 and the edits to 80, 42 and 51 into `spec/roadmap.md`, plus the matching README row and the `arthur.mmd` label. Otherwise the approved design lives only in `plan.md`, where the coordinator does not create tickets from. Should the worker make those roadmap edits here, or in a separate ticket?
