# Changelog

Generated from the merged tickets of `spec/build.json` by `arthur changelog`; a hand edit is overwritten at the next merge.

## 2026-10-30

### Added

- AR0569 Defaults T1: a check call gets 1800 s by itself, pkill is refused, and every steer is an event (cdb0abdc)

### Fixed

- AR0566 Five job roles tell the agent to wait on proc://, which a job sandbox cannot reach (425ca8aa)
- AR0586 The report check tests fail on GitHub CI: its Chrome will not render narrower than 500 px (8c271b51)

### Changed

- AR0564 A report skill: how every HTML page for the owner is styled and checked before it is sent (f60b89db)
- AR0565 limits.test.ts fails under load: three tests race a fixed 3 s job limit (4888ddf5)
- AR0567 AR0311's 18 findings stay open forever though each is already a ticket (4a15b3fc)
- AR0568 After the listen rename, the core still names the voice plugin, and versions.mmd misses four plugins (8faffe55)

## 2026-10-29

### Added

- AR0555 Cleanup after a merge: a merged job leaves no worktree, Docker leftovers, cache, or branch here or on GitHub (21bdc5ff)
- AR0557 GitHub T1: an arthur github command and pull request reads (79553878)

### Fixed

- AR0437 A CI wait still cancels a hung run below the tip, whose end it no longer tells (91c8a24b)
- AR0438 A variable set in the shell alone passes `config check` but is missing for every `arthur` command a job runs (4d95ef30)
- AR0479 A merge step reading an owner clone still deletes it when python3 cannot read the .git attributes, with a reason that hides why (4d1ac2a0)
- AR0481 A stop during the install can end the job before its stop of the install's group is over (e80132da)
- AR0484 A board entry's `path` is never checked, so a filing writes `plan.md` or `review-N.md` outside the project (ee93422d)
- AR0490 A symlink or a HEAD folder the branch itself commits is kept by the sweep (cab65080)
- AR0491 A command substitution inside a fallback word is never judged (45222bfd)
- AR0496 A HOME= set in front of a command is ignored by the guard, so the inner shell reads another HOME (0e336859)
- AR0497 A long option of the other wrappers followed by its value still hides the command (4d7b2940)
- AR0498 The command line `env -S` splits is not read (18285acb)
- AR0510 The GitHub, Telegram and YouTrack API addresses take `http://` for any host, sending the token in the clear (6d1556d9)
- AR0515 The hidden ~/.ssh follows $HOME, while OpenSSH finds the home from the user account (2f79e8ca)
- AR0522 `arthur run`'s stop does not wait for a sweep's copy still in flight (8c353fd9)
- AR0526 A value split across two sweeps' copies of a remote job's log is not named (405e01ba)
- AR0540 A worker blocked on the owner whose ticket is dropped can be neither continued, stopped nor pruned (030a7cf6)
- AR0541 A worker ends its run while its npm test runs in the background, and has no way to read the result (fadd4657)
- AR0545 Bash builtins that set a variable without an assignment word still change git's config unseen (cbbd5833)
- AR0546 A function body or a trap is judged before a later export, and the `function f { }` form is not parsed at all (a634a0ac)
- AR0547 A `~` after a `:` in an assignment's value is not expanded by the parser (0eca382f)

### Changed

- AR0554 Rename the voice plugin to listen (4fcca560)

## 2026-10-28

### Added

- AR0550 Voice: local transcription of voice notes with whisper.cpp (roadmap 81) (6964e6ab)
- AR0551 Video: frames and the spoken words of a video part, with ffmpeg and the voice plugin (c7b4c24d)

### Fixed

- AR0414 A job may commit the stash refusal's .arthur-stash.patch by mistake, and its git diff leaves staged changes out (19577505)
- AR0425 A redirect's lookup in a site check ignores the check's time limit, and a 308 hop has no test (c133bb0d)
- AR0456 The agent's own `npm ci` cannot write `~/.npm` (0ac4520e)
- AR0470 A merge killed during its steps leaves its cache folder behind (4a964c77)
- AR0488 A health check runs `git status` in a main checkout with its `core.fsmonitor` on (61c66613)
- AR0489 A coordinator option ending in `;` splits its `tmux new-session` into tmux commands (58e1232e)
- AR0492 An unquoted `~user` is read as a relative folder named `~user` (09d8b6d7)
- AR0493 A backslash-newline after $ is not removed, so the guard reads a folder name where bash reads .. (b89c5cb8)
- AR0494 The guard skips an escaped quote inside quotes when it finds a fallback end, so a command can hide after it (9b488940)
- AR0524 The worktree guard refuses `GIT_CONFIG_*=... git commit` but lets `export GIT_CONFIG_*=...; git commit` through (ee5ef763)
- AR0531 The env file fixes arthur doctor prints put an unquoted folder in a shell command (3520fee0)
- AR0532 A job final message naming @<path> makes the coordinator read that file into its own context (e79b9701)
- AR0533 A merge decision lifts whichever flag the coordinator names, not the one the owner decided (76f2ab84)
- AR0534 Delivery's review-needed reads `process\.env` in a regex as the secrets file too (56c24517)
- AR0537 A job's own session reads each file its task or a continue's text names as `@<path>` (e8fa77e8)
- AR0538 The coordinator's handoff is handed back through `sendUserMessage` unescaped (e51a7dee)
- AR0539 A `^<model>` in a message's text gives the coordinator's session a model agent (32736d04)

### Changed

- AR0477 Nine exports nobody imports (392ae9be)
- AR0478 Two new plugins made at once still conflict in BUDGETS (0cf2657b)
- AR0523 umask.test.ts and spawn.test.ts put their test job in the production arthur-jobs slice (088fb76b)
- AR0544 The merge step timeout test fails under load: its 3 s limit also catches `npm run check` (bd73579d)
- AR0552 Docs: video in the architecture diagram and roadmap, voice and video as media plugins in the README diagram (285ae5ee)

## 2026-10-27

### Fixed

- AR0343 Git ignores `.env` only, while `core.envFile` may be any name the guard counts as a secrets file (56876e1e)
- AR0374 The install at a spawn and each step of the merge have no time limit (a5779445)
- AR0388 The user's systemd folder is guarded at `~/.config/systemd` only, not at `$XDG_CONFIG_HOME/systemd` (2bc30f66)
- AR0403 Security review of our own code, part 2: injection into shell, git, ssh and tmux, and prompt injection (dae98db4)
- AR0404 Security review of our own code, part 3: channels, merge and delivery (177b80b6)
- AR0405 Security review of our own code, part 4: other machines, network and dependencies (c5e515d5)
- AR0429 The guard misreads four short forms: $ARTHUR_JOB, env -C and sudo -D, a ~ after =, cd $PWD and cd ~+ (55a02d90)
- AR0436 A bash call that changes the tree after its checks, before it ends, is recorded on the tree it ends on (05e0d6e2)
- AR0454 The writable package caches carry branch code out of the sandbox (ff79c610)
- AR0465 A value given again with `-e` sits in the tmux client's command line while it runs (4318b911)
- AR0466 A step can plant a repository under a name other than `.git`, or a symlink to one, which the sweep does not see (dcef9252)
- AR0467 A merge check that runs git inside an owner clone in the checkout deletes that clone history (b7f8edf8)
- AR0468 A second arthur merge during the first one's checks merges on top of the unchecked merge commit (694a4cda)
- AR0469 The reinstall after a failed check uses the cache the branch's install wrote (a4f6e90b)
- AR0471 Other operators of `${PWD…}` and of the known variables read as nothing (6bcc4140)
- AR0472 An escaped variable in an unquoted heredoc reaches the inner shell unread by the guard (0bd9e5cd)
- AR0473 A long option of sudo or env followed by its value hides the command from the guard (e8f33db6)
- AR0474 A review pruned before the merge makes the ticket cost unknown (deb8e6c7)
- AR0487 An `arthur continue` instruction that starts with `-` is an option of `omp` (fb5832e8)
- AR0503 `--no-ci` is a bare flag, "on the owner's word only", with no recorded decision (60a56d83)
- AR0505 The coordinator's role does not say that a `[forwarded from …]` text inside the owner's message is someone else's words (9f7de648)
- AR0506 The Discord plan names no rule for a forwarded message (5b1883ee)
- AR0508 A sandboxed job reads Arthur's SSH private key, and with it gets an unconfined shell on every other machine and a push to origin (ff9650e5)
- AR0509 The sweep's copy from another machine has no size or time bound, so one machine stalls every job on it, or all of `arthur run` (38558fd4)
- AR0516 Since AR0508 hides ~/.ssh, a job and a merge step cannot sign a commit when Git signs with a key there (b2b1c1e4)
- AR0517 Arthur's records, logs, sockets and locks are readable only by Arthur's own user (94f98593)
- AR0518 A token from the env file never appears in a job record, log, error or channel message (3b00352d)
- AR0519 The env guard refuses a command whose text holds the word env after a dot, such as a regex on Node's environment object (0a1d4b83)

### Changed

- AR0464 The stop test of a forked install process fails now and then under a merge step (93da6344)
- AR0475 Line budgets on one line, plus a comment log, conflict on most merges of main (ae463a28)
- AR0476 arthur doctor tells the owner to fix a committed env file with a .gitignore line that cannot help (ed92ed7d)
- AR0511 The github plugin's docs offer a classic token with `repo`, which writes every repository of the account (231e9f1d)
- AR0514 spawn.md still lists a job reaching the user's own SSH login as a limit, which a hidden ~/.ssh mostly ends (de720e86)

## 2026-10-26

### Fixed

- AR0335 The git commands that rewrite the shared repository pass as a documented limit (5141eaef)
- AR0339 A recursive search from the coordinator's own folder prints the env file (ff75b704)
- AR0350 Only YouTrack text is named as data; every other outside text reaches the roles with no rule (AR0311 F12, confirmed) (cc704576)
- AR0354 The mark that tells a job from the coordinator is a variable the job's shell clears (7231be19)
- AR0355 `--unreviewed` and `--budget 0` rest on a sentence in the coordinator's role, with no recorded decision behind them (f373a86c)
- AR0361 A merge takes main as it is: a commit that reached main by another route is merged on and pushed with the next merge (e3164372)
- AR0373 The install of a new worktree and the merge's steps run outside every job scope, with lifecycle scripts on (AR0311 F14, confirmed) (6e75ab11)
- AR0400 `arthur prune` of a job here runs a clean filter the main checkout's config or the job worktree's own names (39aec933)
- AR0431 A review's project is not checked against its worker's (7c8205b5)
- AR0432 The always-review list misses the other installs: composer, uv, yarnrc, pnpmfile and bunfig (eea54efb)
- AR0433 A plugin's wake line built from the final message is not redacted (e61ec246)
- AR0434 A secret-named variable only the coordinator's omp holds is no longer redacted by name (a63bd50d)
- AR0439 A provider's key exported in the shell still reaches every job (fa0bdf8c)
- AR0440 A job can read the running Arthur process's secrets from /proc/<pid>/environ (6ce62c51)
- AR0441 Any merge commit on main resets the baseline, one a job made included (c661a81d)
- AR0443 A job's scope marks it only for a home that holds its record, so a config of the job's own is a coordinator's (319637bf)
- AR0449 The install at a job start and the merge checks run branch code outside the sandbox, where it can read the environment of arthur run (bb0f1aef)
- AR0457 A merge check can leave a git hook or config in main's checkout, which runs outside the sandbox at the next git call (23e91a87)
- AR0458 An install can remove the env file from the record's guarded list, so the agent reads it (17100e1b)
- AR0459 The site draws each diagram at its own size in a small scrolling box, so a reader sees mostly empty space (8113159f)
- AR0463 A merge step can plant a nested repository whose fsmonitor runs at the owner's next git call in that folder (b2f98242)

### Changed

- AR0423 packages/core/test/job-state.test.ts:142 fails now and then with ENOENT on the job record active file (17d51ce6)
- AR0442 An existing project whose history ends in plain commits refuses its first merge, its onboarding's included (8234e81f)
- AR0444 An uptime redirect test fails on GitHub CI: the runner refuses the connection before the private-address check (3af222ae)
- AR0448 packages/core/test/machine.test.ts:719 fails now and then on GitHub CI: a job no longer held is copied again (18 !== 16) (72d581d0)
- AR0450 Polish the docs and make the README shorter (9eb39d8b)
- AR0460 A plugins page on the site, with a page for each plugin (9aec1747)
- AR0461 test/readme.test.ts reads the real env file, and fails inside a job (6fa45467)

## 2026-10-25

### Added

- AR0307 The switch: Arthur runs on the VPS and takes its own tickets (15faf015)
- AR0362 A plain `arthur merge` asks no CI, so a tip whose run ended `failure` goes in on the checks on main alone, unsaid (d95a8869)
- AR0386 Inside a job the read-only `ci <branch>`, `config check`, `doctor`, `retro` and `usage` are refused with the commands that change state (9609309c)

### Fixed

- AR0332 `GIT_DIR=`, `GIT_WORK_TREE=`, `GIT_INDEX_FILE=` before `git` are not read as `--git-dir`, `--work-tree` (059696a4)
- AR0333 `cd -`, `pushd` with no operand and `$OLDPWD` are read as `cd $HOME` (00a0c619)
- AR0337 MCP secrets lie in every job's record, which every other job can read, until the prune (b77e47e9)
- AR0338 A secret exported in the shell reaches every job's environment (71fd8628)
- AR0340 The redaction of notices and the decision log reads secrets from an environment that holds none of the env file (69b7aeca)
- AR0341 A blocked job's question goes to the phone as written, while the decision log redacts it (6d780f86)
- AR0342 A project's `repo` URL is printed by the clone's refusals, with any credential it holds (8409266e)
- AR0344 A pasted secret of capitals, digits and `_` in a `...Env` option is printed by the refusal (432245c4)
- AR0351 A docs-only branch that rewrites the prompt files every later job reads gets `no review` (57f325fd)
- AR0352 The always-review list never matches a path under `.agents/`: `**` does not enter a dot folder (293b4ac4)
- AR0356 The job's `PATH` under the service has no `arthur`, so the line the develop plugin tells a worker to run may not run there (a91c1308)
- AR0357 The review kind takes any task with the three head lines, so a PASS can rest on a task nobody built from the branch (AR0311 F6, confirmed) (d2a58d77)
- AR0358 `review-needed` lets a small change to what the merge and each spawn run go in without a review (AR0311 F11, confirmed) (6da5807e)
- AR0359 `--auto` takes CI passed on an older commit of the branch (AR0311 F13, confirmed) (41b2b86a)
- AR0360 The job's record of its checks is its own word: written from inside the agent, not tied to the tip's tree, not stale after a change by bash (694dcd74)
- AR0363 A binary file counts no lines, so a branch of any binary content skips the review on its checks (36c70b5d)
- AR0364 Telegram answers every member of the configured chat, not the owner alone (AR0311 F7, confirmed) (8a78e74d)
- AR0365 A message the owner forwarded runs as the owner's own words, a phone command included (fc17e26e)
- AR0366 The models plugin's private network holds two cloud metadata addresses (AR0311 F18, confirmed) (8ee419e4)
- AR0367 A site check follows a redirect to any address, loopback and metadata included (d89d43bc)
- AR0368 The probe's curl reads the user's `.curlrc` and the proxy variables, so the request with the key goes where they say (a43f13dd)
- AR0371 The board's lock and temporary files in each project's checkout take the umask too, outside the home's reach (67a0f73c)
- AR0375 The CI workflows set no `permissions` and pin actions and the site's runner by tag (AR0311 F16, confirmed) (7671bc69)
- AR0376 Run each job's agent in a sandbox: the real bound the worktree guard is not (75df243f)
- AR0377 Git's other user config files are not guarded: `~/.config/git/config` and files `~/.gitconfig` includes (ac8bf33e)
- AR0379 A project on Git LFS gets its main pushed without its LFS objects (6df9b99b)
- AR0380 Arthur's git calls in a main checkout still run other programs its config names (fa9078a5)
- AR0381 The worktree guard does not see a git alias or GIT_DIR (6e0f0a1d)
- AR0382 A job's repository on another machine runs its config's hooks in Arthur's git calls there (559c77e0)
- AR0383 A `.git` file or a `commondir` written outside the worktree makes any folder a checkout of main (cdec3c07)
- AR0384 `git replace` from a job's worktree changes what every worktree reads of main's commits (185cc01f)
- AR0393 A remote's `url` can name a transport whose helper runs from PATH (7c89d7fd)
- AR0394 A spawn's push to another machine runs a program the repository's config there names, hooks off or not (d13732e2)
- AR0406 Every sandboxed job exits 1: omp cannot lock its session file under the sandbox, so a review with PASS gets no verdict (a65274c5)
- AR0407 A job's Unix datagram socket reaches any local daemon that listens on one (1256ab3a)
- AR0417 The push's refusal prints a credential git names without `://` (9ffac56c)
- AR0418 A repo URL that new URL cannot parse is printed with its credential by the clone's refusal (458b3aaa)
- AR0420 Forms of OLDPWD and pushd the guard still misreads: ${OLDPWD...} operators, readonly, local outside a function, pushd -n, OLDPWD+= before eval (ccecf8b7)
- AR0424 A redirect's host is resolved twice, so DNS rebinding still reaches a private address (5debe03c)
- AR0426 A forwarded file without a caption reaches the coordinator unmarked (75127d83)
- AR0428 Redaction runs twice on two paths, so the extensions rewrite part of an env-file secret before the plugin can match it whole (ae778efe)

### Changed

- AR0345 Two docs disagree on what Arthur sends another machine (d732ba4f)
- AR0372 The stash refusal tells a job to write its patch to a fixed name in /tmp (4fbe9a47)
- AR0385 `arthur help --help` names nine of the core's seventeen commands as the ones left when the config does not load (bd4169d0)
- AR0401 Inside a sandboxed job, the orchestration tests that start a tmux server fail (a3642537)
- AR0408 versions.mmd still shows the harness in use today (da58fccb)
- AR0409 arthur.config.example.ts says nothing in it runs yet (963c71df)
- AR0410 setup.md step 5 does not say `ci.workflow` needs an `origin` remote (8cd738c7)
- AR0411 setup.md step 5 check reads as if `arthur config check` exits 0 there, while it exits 1 until step 6 (53d87690)
- AR0412 Inside the job sandbox, a test's job wrapper dies writing /proc/self/oom_score_adj, so its agent never starts (c07f6da5)
- AR0419 The workflow test checks neither what the top-level permissions grant nor a .yaml workflow (2095c967)

## 2026-10-23

### Added

- AR0273 Delivery ships no review criteria, so `arthur init` still writes `review.md` as `# Review` (823864e)
- AR0304 A new plugin's ticket without a plan can still be placed on another machine (7ac9b48)
- AR0308 After a check fails at merge, the coordinator continues the worker itself (d977720)
- AR0313 A scenario cannot say a call is made only once (9abe66f)
- AR0314 Delivery's wake after a failed CI run names only the rerun (eb0ddc5)
- AR0315 GitHub's own wake after a failed CI run names only the rerun (34adc87)
- AR0378 A ticket has a Conventional Commits kind, and the board filters by it (64352eb9)

### Fixed

- AR0299 A crash of `arthur run` while a job's question waits for the log's lock loses its notice (c54a670)
- AR0300 The wrapper's append to log can still recreate it while rm -r empties the record (e0a3aea)
- AR0301 core job-control test can fail with ENOENT unlinking continuing under load (3691a8e)
- AR0302 The inbox's backoff tests still measure 5 s and 10 s windows in real time (b0ff5ff)
- AR0303 The test kit's exit removes the sockets of tmux servers a test left, so nothing can reach them (a8e6fe1)
- AR0305 A lock left by a crashed process whose pid the taker now has counts as held by a live process (94846b2)
- AR0306 The agent's extensions still append to `log` with a flag that creates it (7b2d80a)
- AR0309 CI on GitHub fails since 2026-10-21: merge tests have no git identity on the runner (dc3a23c)
- AR0310 `arthur merge` fails for a user with no git identity, only after its review and checks ran (5aae50d)
- AR0316 A listed machine with no git identity is not told, though its workers commit there (acd470e)
- AR0318 A listed machine without git is told to set a git identity, and stays online (3ce46a6)
- AR0319 Security check: secrets stay out of jobs, records, logs and messages (3221ca7)
- AR0320 Security check: a job stays inside its worktree and its own record (c469aa5)
- AR0321 Security check: jobs on another machine write only their own files back (4f4d878)
- AR0322 Security check: text from outside is never taken as the owner's word (a847670)
- AR0323 Security check: which Arthur commands a job itself may run (520ce25)
- AR0324 Security check: only reviewed, green code reaches main (1a98a42)
- AR0325 Security check: the Telegram channel answers the owner alone (9b12277)
- AR0326 Security check: addresses Arthur fetches stay where the config says (77c97ec)
- AR0327 Security check: file modes of Arthur's home, records, sockets and locks (45bdc3b)
- AR0328 Security check: dependencies, installs and the CI workflows (4fa1b7e)
- AR0329 A job is not isolated from Arthur's code, config and the user's own files (AR0311 F1, confirmed) (03d7550)
- AR0330 `git config` from a job rewrites the shared repository's config and the user's (AR0311 F2, confirmed) (8702f7e)
- AR0331 A job can point its own worktree at `main`, after which every allowed git write lands on main (3043c2a)
- AR0346 A copy from another machine writes a file under the name the answer gives, which may be a path (3864b01)
- AR0347 The copy's deny-list misses the keys this side acts on: the branch fetched is whatever the copied record names (cc48b903)
- AR0349 A line inside a job's final message or a GitHub review reads as a paragraph from the owner (AR0311 F4, confirmed) (587442ae)
- AR0353 No command but three asks whether it runs inside a job: a job merges, spawns, stops, sends and moves the board (AR0311 F5, confirmed) (a1d953d2)
- AR0370 The home and everything under it take the process umask: records, logs, the event log and every lock are readable by other users of the host (AR0311 F15, confirmed) (c7d9eab2)

### Changed

- AR0312 The eval baseline of delivery/check-failed measures the old scenario (7ade4f3)
- AR0317 The baseline of delivery/check-failed predates its stricter expectations (c05de11)

## 2026-10-22

### Added

- AR0269 The disk check makes a second ssh call per machine and round (2bb5ec1)
- AR0274 A worker learns of `arthur plugin new --root` only if its ticket or plan names it (aa8e03e)
- AR0275 Roadmap 65: the morning report (7b872a1)
- AR0276 Roadmap 67: evals, the runner (63e7408)
- AR0278 In an eval run, `arthur <command> --help` answers only what the scenario's stub says (7732a3d)
- AR0279 An eval turn gets the coordinator's role but not its context, nor a time of day (f582f7d)
- AR0280 Roadmap 68: evals, the scenarios (1978fb0)
- AR0281 Roadmap 96: the decision log (88ec6c6)
- AR0282 The decision log's race test catches a missing lock only in most runs (d85fed6)
- AR0284 Roadmap 97: decision classes (34bdce0)
- AR0285 A job's question answered by policy still reaches the owner as a question (cdc0ad1)
- AR0292 A check of its own still makes two ssh calls to a machine with a disk floor (59b78a4)
- AR0295 The fixtures have no vision, so every eval context warns the main project has none (689f6fb)

### Fixed

- AR0271 Two processes checking one machine at once can both say the same news (92228a0)
- AR0272 Arthur's own repository has no criteria folder, so its audits and retros run without their criteria (8d5d6bd)
- AR0277 The eval words a turn with a copy of orchestration's wake and inbox lines, which can drift (c4047e0)
- AR0283 A job's question and the plugin's closes take the log's lock synchronously inside `arthur run` (d50431a)
- AR0286 The coordinator's role has no rule for a night answer, which orchestration/night-one-line measures (8708aa9)
- AR0287 A plugin's wake lines for a review or an onboarding cannot reach an eval's turn, even once AR0277 words it (fc89048)
- AR0288 The eval stub answers a command's --help with that command's scripted result (3b718b5)
- AR0289 The eval still words a schedule entry with its own copy of the schedule plugin's `[scheduled <id>]` line (cee3d3f)
- AR0290 The telegram menu test failed once in a full `npm test` and passes alone (4b8b178)
- AR0293 An orchestration inbox test overshoots its 30 s real-timer window under load (fbf9607)
- AR0294 An eval turn's plugin context lines are the live Arthur's, which a scenario cannot set (dae5a18)
- AR0296 An orchestration test can leave its tmux server and fake agent running after `npm test` (5249d15)
- AR0297 The styleguide and review criteria now live in two folders that will drift (bb00d85)
- AR0298 On another machine the checkout a job reaches has no arthur.config.ts, so the line of `arthur plugin new` cannot run there (b9d649e)

### Changed

- AR0270 vision.md's disk refusal example differs from the roadmap and the code (85a4d58)
- AR0291 The scenarios' `(?!.*--help)` guards are dead weight once the stub prints help itself (fdf7054)

## 2026-10-21

### Added

- AR0239 Roadmap 54: arthur merge (2b0d0b4)
- AR0240 Roadmap 60: arthur health (aaf9d45)
- AR0243 The onboarding procedure does not name the command that merges an onboarding (9611adf)
- AR0244 Roadmap 61: arthur stats (0baba9d)
- AR0246 Roadmap 58: arthur ci, reruns, pushes, pull request reviews (1f039d3)
- AR0247 Roadmap 55: hand-back after a FAIL review (42cfa5b)
- AR0252 Roadmap 56: arthur changelog (a5ed83a)
- AR0253 Roadmap 59: auto-merge after PASS and green CI (98cfb0f)
- AR0254 Roadmap 64: prune and temporary folders on a schedule (bcce4ca)
- AR0256 Roadmap 66: arthur plugin new (456975d)
- AR0257 A waiting branch's CI end wakes the coordinator twice (044d050)
- AR0258 The coordinator's role names merges only on the owner's word (d5ba054)
- AR0260 `arthur plugin new` writes into the project's checkout, never a job's worktree (ee75ab0)
- AR0261 Roadmap 62: the audit (1212afc)
- AR0262 Roadmap 69: free disk space per machine (92cfbeb)
- AR0263 Roadmap 83: findings, what happens to them per project (e0d14fb)
- AR0264 `arthur init` writes the audit criteria as a bare title, not the criteria manage ships (a185ca3)
- AR0265 No health line for a finished audit that was never filed (18a2583)
- AR0266 Roadmap 63: the retro (fcf48c3)
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

## 2026-10-20

### Added

- AR0220 YouTrack: open issues grouped by state, and full create, edit, delete of issues and articles (e037b36)
- AR0221 Roadmap 49: Telegram media in and out, arthur send (718a54a)
- AR0222 YouTrack: the rest of full management, links, tags, search, articles like issues (a639c13)
- AR0224 Roadmap 50: Telegram phone commands and the menu (a5028bd)
- AR0227 Roadmap 98: uptime, each project's sites checked (4cf42d3)
- AR0228 Roadmap 51: freeze the host API (2e73ad8)
- AR0234 MCP servers for the coordinator and every role, set globally or per role (5bede8d)
- AR0235 Roadmap 52: review jobs (7552dfc)
- AR0236 Roadmap 57: GitHub polling CI runs (c5ecd88)
- AR0237 Roadmap 53: arthur review-needed (534f5c3)

### Fixed

- AR0223 A restart between a part claim reply and the inbox queue sends the reply twice (7f2c3b9)
- AR0225 A phone command does not learn which named bot it came through (8b4e8b0)
- AR0226 The outbox's retry test failed once in a full test run (fe8699a)
- AR0232 A site on a port that fetch blocks is reported down forever, as `bad port` (3526d40)

### Changed

- AR0230 Two comments still name what AR0228 changed (7b930a4)

## 2026-10-19

### Added

- AR0127 Roadmap: a silent mode for the coordinator in the channels (9327313)
- AR0146 Caps per feature on CPU and memory are not held, and not said, on a machine without a user manager
- AR0147 A ticket over its memory cap ends a job `failed: the agent was killed by ...`, not `limit: memory`
- AR0149 The free-resources check runs on its own 60 s timer, not at each machines check (ea8aa95)
- AR0153 Roadmap 37: Restart guard (2799aaa)
- AR0156 `--autopilot` does not read a ticket's own budget
- AR0157 Roadmap 38: Start notice and LLM probe (289fa48)
- AR0158 Roadmap 39: Schedule entries and the sweep (32f5997)
- AR0160 `/restart` cannot clear a restart due, since it restarts only the coordinator's agent (c51c1ce)
- AR0163 Roadmap 40: Registered entries and arthur schedule (f3e9ecc)
- AR0165 A provider outage sends a `turn failed` notice at every retry of the inbox
- AR0166 Roadmap 80: arthur doctor, checked at every start (27a50bd)
- AR0169 A registered entry can send a message or spawn a job, not run its plugin's own code
- AR0170 Roadmap 93: Option tables, every option with its meaning, and the tools each plugin runs (8032932)
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

## 2026-10-18

### Added

- AR0098 Plan: an agent per project with its own channel, and Discord and Slack channels (5cbfc1c)
- AR0110 Roadmap 26: maxAgents and the models of each role (5dfeb7e)
- AR0116 Lessons from the predecessor: two worker rules and three roadmap edge cases (1e52be0)
- AR0118 The setup guide has an optional Tailscale step for other machines (74729e0)
- AR0120 Roadmap 25: the coordinator's context on every turn (be0d3db)
- AR0121 Roadmap 27: job state in the coordinator and the channels (6987f04)
- AR0123 Roadmap 28: Planning of large tickets (38ce792)
- AR0124 Roadmap 30: Machines: the list, labels, and SSH checks (05828fd)
- AR0125 Roadmap 31: Machines: placing a job by labels (5dd1733)
- AR0126 Roadmap 32: Resources: caps per job (1bde258)
- AR0134 Roadmap: Discord as a first-version channel, and own apps over Tailscale (0a41782)
- AR0140 Roadmap 29: Autopilot (905cc9a)
- AR0141 Roadmap 33: Resources: caps per feature (2376bf5)
- AR0142 Roadmap 34: Resources: how many jobs run, from each machine's free resources (3d25315)
- AR0143 Roadmap 35: Compaction during the day (e91a0df)
- AR0144 Roadmap 36: Fresh start, /restart and /restart fresh (f419a71)

### Fixed

- AR0111 A hand-over omp accepts and then fails leaves the inbox waiting until a restart (66fb3d3)
- AR0112 A turn that keeps failing is handed its messages again every second, without a pause (c1f0e3d)
- AR0113 The inbox is proved once against real omp: mid-turn join, resumed turn, willContinue (1f6adb6)
- AR0136 A flaky test that fails GitHub CI now and then is found and fixed (f520142)

### Changed

- AR0114 README's orchestration row shows entries 24 and 26 as not built (c062de4)
- AR0115 arthur.mmd shows project agents in the first version, and orchestration as 1 of 8 entries built (7af750c)

## 2026-10-17

### Added

- AR0033 An unknown `--project` name reaches the command unchecked (2f47a42)
- AR0084 Roadmap 24: the coordinator's inbox, the wake, and a human's message mid-turn (6d1b90b)
- AR0087 Roadmap 41: the project list, planned from the harness projects (04ec21e)
- AR0090 The coordinator role explains every ticket and question to an owner who knows nothing of them (4aefdb4)
- AR0094 Roadmap 23: The coordinator's process and arthur attach (3a3f14a)
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

## 2026-10-16

### Added

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
- AR0027 Dev dependencies beyond the toolchain are not checked (226d399)
- AR0031 `arthur config check` passes a plugin list the host refuses (19a97a0)
- AR0034 Roadmap: disk space and Docker cleanup with each worktree (af0e47f)
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
