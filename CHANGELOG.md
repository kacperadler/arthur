# Changelog

Generated from `spec/features/` by `h changelog`; a hand edit is overwritten at the next merge.

## 2026-10-18

### Added

- AR0098 Plan: an agent per project with its own channel, and Discord and Slack channels (5cbfc1c)
- AR0116 Lessons from the predecessor: two worker rules and three roadmap edge cases (1e52be0)
- AR0118 The setup guide has an optional Tailscale step for other machines (74729e0)

### Fixed

- AR0111 A hand-over omp accepts and then fails leaves the inbox waiting until a restart (66fb3d3)
- AR0112 A turn that keeps failing is handed its messages again every second, without a pause (c1f0e3d)
- AR0113 The inbox is proved once against real omp: mid-turn join, resumed turn, willContinue (1f6adb6)
- AR0136 A flaky test that fails GitHub CI now and then is found and fixed (f520142)

### Changed

- AR0114 README's orchestration row shows entries 24 and 26 as not built (c062de4)
- AR0115 arthur.mmd shows project agents in the first version, and orchestration as 1 of 8 entries built (7af750c)

### Other

- AR0110 Roadmap 26: maxAgents and the models of each role (5dfeb7e)
- AR0120 Roadmap 25: the coordinator's context on every turn (be0d3db)
- AR0121 Roadmap 27: job state in the coordinator and the channels (6987f04)
- AR0124 Roadmap 30: Machines: the list, labels, and SSH checks (05828fd)
- AR0125 Roadmap 31: Machines: placing a job by labels (5dd1733)
- AR0126 Roadmap 32: Resources: caps per job (1bde258)

## 2026-10-17

### Added

- AR0033 An unknown `--project` name reaches the command unchecked (2f47a42)
- AR0090 The coordinator role explains every ticket and question to an owner who knows nothing of them (4aefdb4)
- AR0101 A diagram in the repository root of what Arthur is built from, built and not yet built (37081c1)
- AR0103 The README tells a newcomer what Arthur is, what works today, and how to try it (a1b3299)
- AR0105 A landing page and docs site for Arthur, built with Astro Starlight (b377424)
- AR0106 A conductor logo for Arthur (884525a)
- AR0107 Plan: arthur setup finds the tools, shows the config, and a setup guide (533b31d)
- AR0109 The browser tab icon is a crop of the logo badge (264289c)

### Fixed

- AR0059 The worktree guard knows only its own project's checkout (0177255)
- AR0083 arthur prune with no ids refuses; --all prunes every finished job (d799302)
- AR0085 A continue killed between its new wrapper's `pid` and `state` lets a second continue start beside the running wrapper (0a3ae06)
- AR0091 An ssh that exits before reading its input fails as EPIPE instead of with ssh's own line (531c8e9)
- AR0092 A project added while a job runs is guarded from that job at once (ecaf58f)
- AR0099 CI on GitHub is red: three tests need a git identity or a systemd user session (ab5a288)

### Changed

- AR0080 /board, /task and /findings move into orchestration, with host.jobs.list() (5dc7de2)
- AR0081 `arthur config check` still reports two plugins of one name twice (dae7ec2)
- AR0093 The job runner's prune still treats an empty list as every finished job (1822526)

### Other

- AR0084 Roadmap 24: the coordinator's inbox, the wake, and a human's message mid-turn (6d1b90b)
- AR0087 Roadmap 41: the project list, planned from the harness projects (04ec21e)
- AR0094 Roadmap 23: The coordinator's process and arthur attach (3a3f14a)

## 2026-10-16

### Added

- AR0027 Dev dependencies beyond the toolchain are not checked (226d399)
- AR0031 `arthur config check` passes a plugin list the host refuses (19a97a0)
- AR0035 An event a command emits reaches the log but not the daemon's subscribers (a8039bf)
- AR0038 Roadmap: Later entries for the web panel, a knowledge base and a company edition (ea98772)
- AR0039 `arthur config check` says ok when a plugin's `setup` refuses the start (82a9965)
- AR0041 Roadmap 35-36: a handoff before compaction, and a fresh start that retries (ec7ac04)
- AR0043 `/restart fresh` starts a new conversation without the handoff (438705e)
- AR0046 Roadmap: arthur doctor checks what Arthur needs at every start (1fa33f6)
- AR0048 A worker spawned on a ticket still in planning, or merged or dropped, starts anyway (cb93a10)
- AR0049 `/findings` does not show findings a worker wrote on its branch (cbfd577)
- AR0055 Roadmap: channels hand media to plugins; local voice transcription (d4e23cc)
- AR0063 Roadmap: model providers on other machines, with a fallback chain (0fc8be3)

### Fixed

- AR0026 `arthur plugin new` meets the line-budget rule (a263149)
- AR0028 An instance name can produce the same variable prefix as another plugin (859864c)
- AR0030 Owner lookup takes the first longer prefix, not the longest (6ec64d6)
- AR0032 A phone command name with a dash cannot go into Telegram's command menu (5194823)
- AR0036 The lock's dead-holder takeover race has no test (73aa034)
- AR0040 A crash mid-write leaves the board's lock or temporary file in the project's `spec/` (1d374f8)
- AR0042 A project with a branch named `arthur` can spawn no worker (7e8d03d)
- AR0044 An event a command appends while no daemon runs never reaches the subscribers (f7beab3)
- AR0047 The fake host does not move a worker's ticket when the worker starts (a1abefa)
- AR0053 An agent that ignores SIGTERM runs on past its limit
- AR0054 Roadmap entry 23 does not say the coordinator loads the env guard (71b8c57)
- AR0056 A `systemd-run` that fails after the slice was set leaves a job that never ends (973a285)
- AR0058 The styleguide forbids a plugin to read another plugin's folder, and voice reads the channel's saved file (f3a1261)
- AR0060 The fake host does not refuse a worker whose ticket cannot move to in-progress (e5aa2d6)
- AR0062 A worker spawned during a plugin's `setup` skips the core's ticket check in a real load (b16ef94)
- AR0065 `arthur continue` starts an agent without the plugins' `beforeSpawn` checks (cd2bde1)
- AR0066 A process that holds the agent's stdout open keeps the wrapper from ending the job (7e88ef3)
- AR0067 Two `arthur continue` at once can start two wrappers on one record where the job runs bare (9dfd852)
- AR0068 A continued worker leaves its ticket in review or done (06ad940)
- AR0070 An `arthur continue` killed before its wrapper starts leaves `continuing`, and the job is never continued again (8e9fcd3)
- AR0071 A pruned worker whose branch Git keeps loses its worktree, so `arthur continue` on it cannot start (81a3c42)

### Changed

- AR0029 README still says no feature code exists (e58e20e)
- AR0050 Roadmap entry 8 still says the events logged before the daemon started are not delivered (321618c)
- AR0057 The vision and the architecture diagrams do not name the voice plugin or the channels' parts (ab17f2e)
- AR0064 The `models` plugin is missing from the vision and the architecture diagrams (166516e)
- AR0069 Core line review: what moves to a plugin or goes (e4dc435)
- AR0073 Core: one plugin-entry check, one describe, one step guard, one record reader (76d4505)
- AR0074 Core: one flag parser for the CLI, spawn and continue (d6b7621)
- AR0075 `arthur ticket all` goes; `arthur board all` is the full board (fccbd27)
- AR0076 Core comments that repeat the command docs become pointers (50e254e)
- AR0077 The node_modules copy moves to a prepare hook of the projects plugin (3d31a1c)
- AR0078 The checks record file moves out of the wrapper into a delivery extension (02bd0f2)
- AR0079 Core line budget 5080 for entries 1 to 22, with the allotment per entry (bc338cb)

### Other

- AR0001 Bootstrap: Arthur repository, docs, toolchain and the feature roadmap (bf0b60a)
- AR0002 Roadmap: job state, several machines, and resource-based limits (31d5a1d)
- AR0004 Roadmap 1: Repository rules as a test (705dc1f)
- AR0005 Roadmap 2: Config: defineConfig and the core's options (dd698ee)
- AR0006 Roadmap 3: Config: env names, .env, and arthur config check (dfa9ef5)
- AR0007 Roadmap 4: Plugin host, and the fake host (287f0c7)
- AR0008 Roadmap 5: Event stream (7c8a5ce)
- AR0009 Roadmap 6: Command registry and the arthur CLI (3e5fc73)
- AR0010 Roadmap 7: Clock: time zone and quiet hours (db203fd)
- AR0011 Roadmap 8: arthur run: Arthur as a process (dd9cacd)
- AR0012 Roadmap 9: Job runner: spawn and the job record (30a43af)
- AR0013 Roadmap 10: Prompt loader and arthur roles (3582642)
- AR0014 Roadmap 11: Job runner: the wrapper, and the fake agent (8995340)
- AR0015 Roadmap 12: Job limits: time and budget (0a053a3)
- AR0016 Roadmap 13: Job limits: one scope per job in a joint slice (3308105)
- AR0017 Roadmap 14: Stop, continue, steer (3bde36e)
- AR0018 Roadmap 15: Jobs list, prune, dead jobs, and their phone commands (58a6aa5)
- AR0019 Roadmap 16: Job state: working, idle, blocked, ended (8d28e21)
- AR0020 Roadmap 17: Ticket board: tickets and the board file (9819d29)
- AR0021 Roadmap 18: Ticket board: transitions, after, the digest, and the board's phone commands (e9c57dc)
- AR0022 Roadmap 19: Env guard (ebc6a89)
- AR0023 Roadmap 20: Worktree guard and its shell parser (29ed9c0)
- AR0024 Roadmap 21: Jobs on another machine: spawn, run, and the branch back (113b11d)
- AR0025 Roadmap 22: Jobs on another machine: stop, steer, continue, and the machine going offline (46179d2)
- AR0034 Roadmap: disk space and Docker cleanup with each worktree (af0e47f)
