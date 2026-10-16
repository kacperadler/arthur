# Changelog

Generated from `spec/features/` by `h changelog`; a hand edit is overwritten at the next merge.

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

### Changed

- AR0029 README still says no feature code exists (e58e20e)
- AR0050 Roadmap entry 8 still says the events logged before the daemon started are not delivered (321618c)
- AR0057 The vision and the architecture diagrams do not name the voice plugin or the channels' parts (ab17f2e)
- AR0064 The `models` plugin is missing from the vision and the architecture diagrams (166516e)
- AR0069 Core line review: what moves to a plugin or goes (e4dc435)
- AR0073 Core: one plugin-entry check, one describe, one step guard, one record reader (76d4505)
- AR0074 Core: one flag parser for the CLI, spawn and continue (d6b7621)
- AR0077 The node_modules copy moves to a prepare hook of the projects plugin (3d31a1c)

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
- AR0020 Roadmap 17: Ticket board: tickets and the board file (9819d29)
- AR0021 Roadmap 18: Ticket board: transitions, after, the digest, and the board's phone commands (e9c57dc)
- AR0022 Roadmap 19: Env guard (ebc6a89)
- AR0023 Roadmap 20: Worktree guard and its shell parser (29ed9c0)
- AR0034 Roadmap: disk space and Docker cleanup with each worktree (af0e47f)
