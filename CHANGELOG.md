# Changelog

Generated from `spec/features/` by `h changelog`; a hand edit is overwritten at the next merge.

## 2026-10-22

### Added

- AR0269 The disk check makes a second ssh call per machine and round (2bb5ec1)
- AR0274 A worker learns of `arthur plugin new --root` only if its ticket or plan names it (aa8e03e)
- AR0278 In an eval run, `arthur <command> --help` answers only what the scenario's stub says (7732a3d)
- AR0279 An eval turn gets the coordinator's role but not its context, nor a time of day (f582f7d)
- AR0282 The decision log's race test catches a missing lock only in most runs (d85fed6)
- AR0285 A job's question answered by policy still reaches the owner as a question (cdc0ad1)

### Fixed

- AR0271 Two processes checking one machine at once can both say the same news (92228a0)
- AR0272 Arthur's own repository has no criteria folder, so its audits and retros run without their criteria (8d5d6bd)
- AR0277 The eval words a turn with a copy of orchestration's wake and inbox lines, which can drift (c4047e0)
- AR0283 A job's question and the plugin's closes take the log's lock synchronously inside `arthur run` (d50431a)
- AR0288 The eval stub answers a command's --help with that command's scripted result (3b718b5)

### Changed

- AR0270 vision.md's disk refusal example differs from the roadmap and the code (85a4d58)
- AR0291 The scenarios' `(?!.*--help)` guards are dead weight once the stub prints help itself (fdf7054)

### Other

- AR0275 Roadmap 65: the morning report (7b872a1)
- AR0276 Roadmap 67: evals, the runner (63e7408)
- AR0280 Roadmap 68: evals, the scenarios (1978fb0)
- AR0281 Roadmap 96: the decision log (88ec6c6)
- AR0284 Roadmap 97: decision classes (34bdce0)
- AR0286 The coordinator's role has no rule for a night answer, which orchestration/night-one-line measures (8708aa9)
- AR0287 A plugin's wake lines for a review or an onboarding cannot reach an eval's turn, even once AR0277 words it (fc89048)

## 2026-10-21

### Added

- AR0243 The onboarding procedure does not name the command that merges an onboarding (9611adf)
- AR0257 A waiting branch's CI end wakes the coordinator twice (044d050)
- AR0258 The coordinator's role names merges only on the owner's word (d5ba054)
- AR0260 `arthur plugin new` writes into the project's checkout, never a job's worktree (ee75ab0)
- AR0264 `arthur init` writes the audit criteria as a bare title, not the criteria manage ships (a185ca3)
- AR0265 No health line for a finished audit that was never filed (18a2583)
- AR0267 The procedure after a merge settles review notes as tickets whatever the project's findings mode (e82d8fd)

### Fixed

- AR0238 A rerun keeps its run id, so its end is never told as `ci-finished`
- AR0241 arthur merge installs from the lockfile and never reads a project's own install (5d9c3fe)
- AR0242 The checks on main run on the service's Node, not the project's .nvmrc (a81486a)
- AR0248 A branch `arthur review-needed` waves through is never pushed, so CI never builds it before its merge (beec2df)
- AR0250 A pull request closed and reopened has its reviews told again (bad0ec0)
- AR0251 A hand-back refused for good is retried at every run's end, silently (076ee29)
- AR0255 The poll's time is this machine's clock, compared with GitHub's `submitted_at` (c0548af)
- AR0259 The example config gives delivery an option it refuses (6d9aaf1)

### Changed

- AR0245 arthur stats: remove the unreachable unknown-project throw (4116eec)
- AR0249 The vision still says `ci-finished` is keyed by run id
- AR0268 The coordinator's role names `arthur findings`, which a config without the findings plugin no longer has (2796ca0)

### Other

- AR0239 Roadmap 54: arthur merge (2b0d0b4)
- AR0240 Roadmap 60: arthur health (aaf9d45)
- AR0244 Roadmap 61: arthur stats (0baba9d)
- AR0246 Roadmap 58: arthur ci, reruns, pushes, pull request reviews (1f039d3)
- AR0247 Roadmap 55: hand-back after a FAIL review (42cfa5b)
- AR0252 Roadmap 56: arthur changelog (a5ed83a)
- AR0253 Roadmap 59: auto-merge after PASS and green CI (98cfb0f)
- AR0254 Roadmap 64: prune and temporary folders on a schedule (bcce4ca)
- AR0256 Roadmap 66: arthur plugin new (456975d)
- AR0261 Roadmap 62: the audit (1212afc)
- AR0262 Roadmap 69: free disk space per machine (92cfbeb)
- AR0263 Roadmap 83: findings, what happens to them per project (e0d14fb)
- AR0266 Roadmap 63: the retro (fcf48c3)

## 2026-10-20

### Added

- AR0220 YouTrack: open issues grouped by state, and full create, edit, delete of issues and articles (e037b36)
- AR0221 Roadmap 49: Telegram media in and out, arthur send (718a54a)
- AR0222 YouTrack: the rest of full management, links, tags, search, articles like issues (a639c13)
- AR0224 Roadmap 50: Telegram phone commands and the menu (a5028bd)
- AR0227 An uptime plugin: Arthur checks client sites and tells the owner when one is down (4cf42d3)
- AR0228 Roadmap 51: freeze the host API (2e73ad8)

### Fixed

- AR0223 A restart between a part claim reply and the inbox queue sends the reply twice (7f2c3b9)
- AR0225 A phone command does not learn which named bot it came through (8b4e8b0)
- AR0226 The outbox's retry test failed once in a full test run (fe8699a)
- AR0232 A site on a port that fetch blocks is reported down forever, as `bad port` (3526d40)

### Changed

- AR0230 Two comments still name what AR0228 changed (7b930a4)

### Other

- AR0234 MCP servers for the coordinator and every role, set globally or per role (5bede8d)
- AR0235 Roadmap 52: review jobs (7552dfc)
- AR0236 Roadmap 57: GitHub polling CI runs (c5ecd88)
- AR0237 Roadmap 53: arthur review-needed (534f5c3)

## 2026-10-19

### Added

- AR0127 Roadmap: a silent mode for the coordinator in the channels (9327313)
- AR0146 Caps per feature on CPU and memory are not held, and not said, on a machine without a user manager
- AR0147 A ticket over its memory cap ends a job `failed: the agent was killed by ...`, not `limit: memory`
- AR0149 The free-resources check runs on its own 60 s timer, not at each machines check (ea8aa95)
- AR0156 `--autopilot` does not read a ticket's own budget
- AR0160 `/restart` cannot clear a restart due, since it restarts only the coordinator's agent (c51c1ce)
- AR0165 A provider outage sends a `turn failed` notice at every retry of the inbox
- AR0169 A registered entry can send a message or spawn a job, not run its plugin's own code
- AR0172 The tools labels of local are not checked by arthur doctor
- AR0174 Roadmap: a decision log of what the owner decided when Arthur asked (8b7a138)
- AR0176 The roadmap has no entry yet for decisions pre-approved from the decision log
- AR0179 Roadmap 94: arthur setup, what is there, what is set, what is missing (f3f1b88)
- AR0180 While an env variable is missing, neither `arthur doctor` nor `arthur setup` checks the plugins' requirements
- AR0181 Roadmap 42: Onboarding a repository (9239fdd)
- AR0184 The `.nvmrc` that `arthur init` writes is read by nothing until the nvm plugin (84)
- AR0185 The coordinator's role does not say when to run `arthur init` and start an onboarding
- AR0186 `arthur init` writes the criteria skeletons of today's roles only
- AR0187 Roadmap 82: models on other machines, and a fallback chain (bb71f18)
- AR0188 Roadmap 43: commit rules per project (72692ea)
- AR0189 Roadmap 44: YouTrack instances and reading (2bda2a3)
- AR0191 The 30 s reuse of a probe holds in one process only, so two `arthur spawn` commands each probe (06fa19c)
- AR0193 The doctor checks omp's `models.yml` on this machine only
- AR0194 The coordinator's role does not name `arthur youtrack`
- AR0195 `arthur youtrack issue list` reads every issue of a project, resolved ones too
- AR0196 Roadmap 84: nvm, each project's Node version (1556c9f)
- AR0197 Roadmap 45: YouTrack writing issues, articles, fields and work items (4919c0a)
- AR0198 A plugin's prompt section cannot add to the spawn's warnings
- AR0200 The example's Conventional Commits regex allows subjects over 72 characters
- AR0203 Arthur is Apache-2.0, with NOTICE, trademark and DCO (d284b8c)
- AR0205 The coordinator's role does not say when it may write to YouTrack
- AR0206 Roadmap 46: YouTrack comments, attachments, and the rules for jobs (00b089f)
- AR0208 Roadmap 47: Telegram receive and send text, and the silent mode (16c2dc6)
- AR0211 A message to a named bot is answered by the unnamed one
- AR0212 Roadmap 48: Telegram outbox and retries (8de5935)
- AR0218 With check.everySeconds above 120 a spawn between rounds still checks a listed machine over ssh itself (e0c0a28)

### Fixed

- AR0135 The inbox drops a new message whose event number an old one had, after the event log is cut by hand
- AR0137 The burst test still relies on the test's 300 ms timers staying under a second
- AR0145 A continued job sets its ticket's slice from the caps kept at its spawn (b4ab6a6)
- AR0148 A throw in the session's 500 ms tick ends `arthur run` (cee952c)
- AR0150 Free cores come from the 1-minute load average, which on Linux also counts processes waiting on disk
- AR0154 A pre-approved ticket's budget is recorded, not held at its worker's spawn (3ff3338)
- AR0155 Two `--autopilot` runs on one ticket at once can both record it
- AR0161 `host.code` finds a plugin's package by its name, not by the module the config imported
- AR0164 The inbox's notice after 3 unanswered turns repeats omp's error unredacted (1bf2a8a)
- AR0167 GitHub CI fails now and then on main with the same code (59e5760)
- AR0168 Orchestration cannot register the morning report while schedule is optional
- AR0171 The resources scope test assumes a machine of 2 cores or more
- AR0173 GitHub CI names each failed test and stays green on main (a1fbecb)
- AR0175 A `/restart` whose restart throws in the tick tells the owner nothing
- AR0177 An option's `default` is text beside the code's own default, and nothing checks they agree (41a59ad)
- AR0190 `arthur continue` of a job on a provider model starts the agent without its provider
- AR0201 wrapper.test.ts failed once on a cleanup race (244a725)
- AR0202 A record removed file by file crashes the wrapper instead of ending it with its one line
- AR0204 `issue update` overwrites a description changed since it was read
- AR0213 A pre-approved ticket's worker on a free model is refused (bd3400d)
- AR0217 A ticket's memory cap can be stretched by swap
- AR0219 schedule.register still finds a plugin's package folder by its name

### Changed

- AR0151 The example config and two diagrams still call Discord later (e373e84)
- AR0152 Roadmap entry 93 depends on 41 but sits before it
- AR0192 The roadmap's Tailscale IPv6 range and the machines plugin's disagree
- AR0199 The option-tables test cannot list a plugin without options (d7bd88e)
- AR0207 The option-tables test cannot hold a plugin without options, so nvm's options file is not checked there
- AR0210 The nvm package still names the old licence (e9e6d98)
- AR0215 The commit-rules doc shows the regex that counts 72 after the prefix

### Other

- AR0153 Roadmap 37: Restart guard (2799aaa)
- AR0157 Roadmap 38: Start notice and LLM probe (289fa48)
- AR0158 Roadmap 39: Schedule entries and the sweep (32f5997)
- AR0163 Roadmap 40: Registered entries and arthur schedule (f3e9ecc)
- AR0166 Roadmap 80: arthur doctor, checked at every start (27a50bd)
- AR0170 Roadmap 93: Option tables, every option with its meaning, and the tools each plugin runs (8032932)

## 2026-10-18

### Added

- AR0098 Plan: an agent per project with its own channel, and Discord and Slack channels (5cbfc1c)
- AR0116 Lessons from the predecessor: two worker rules and three roadmap edge cases (1e52be0)
- AR0118 The setup guide has an optional Tailscale step for other machines (74729e0)
- AR0134 Roadmap: Discord as a first-version channel, and own apps over Tailscale (0a41782)

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
- AR0123 Roadmap 28: Planning of large tickets (38ce792)
- AR0124 Roadmap 30: Machines: the list, labels, and SSH checks (05828fd)
- AR0125 Roadmap 31: Machines: placing a job by labels (5dd1733)
- AR0126 Roadmap 32: Resources: caps per job (1bde258)
- AR0140 Roadmap 29: Autopilot (905cc9a)
- AR0141 Roadmap 33: Resources: caps per feature (2376bf5)
- AR0142 Roadmap 34: Resources: how many jobs run, from each machine's free resources (3d25315)
- AR0143 Roadmap 35: Compaction during the day (e91a0df)
- AR0144 Roadmap 36: Fresh start, /restart and /restart fresh (f419a71)

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
