# AR0405 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

Every entry comes from the review in `security-review.md` beside this file, which holds the commands and their output.

## F1. A sandboxed job reads Arthur's SSH private key, and with it gets an unconfined shell on every other machine and a push to origin

- Kind: security
- Severity: high
- Found by: 2026-10-27-worker-03ddbe1b (worker), 2026-10-27
- Where: `packages/core/src/job-sandbox.ts:79-82` (`hidden`: only the env file), `:67-74` (`writable`), `packages/core/src/job-machine.ts:21` (the key `ssh` uses with `BatchMode=yes`, so one that needs no passphrase), `packages/core/docs/commands/spawn.md:116` (`~/.ssh` can be read), `docs/deploy.md:31`, `:44`
- Input: any program a job runs in its sandbox: the agent steered by outside text, the branch's own code, a dependency's install script (`packages/core/src/job-install.ts`, run in the same sandbox).
- Why the check misses it: the sandbox hides only the env file (`hidden`), and nothing limits the network (`docs/deploy.md:44`). Probe (`security-review.md`, area 1): the real `sandboxed()` over a temporary folder printed a fake `home/.ssh/id_fake` whole, while the hidden env file and a write into `home/.ssh/` gave `Permission denied`. The key that `ssh <machine> true` uses without a prompt (`docs/setup.md:251-256`, `docs/deploy.md:14`) is such a file. The worktree guard and the sandbox bound only what a job writes here.
- What: one job, on the VPS, runs `ssh <machine> <anything>` as Arthur's user there, outside that machine's sandbox and job scope: it rewrites `repos/<project>.git` there (hooks, other jobs' branches), Arthur's install there, `~/.ssh/authorized_keys` there; and where the same key is a GitHub key (a deploy key with write access or an account key), `git push` to origin's main straight from the worktree, which `arthur merge`'s review and its stray-commit check never see (`docs/deploy.md:42` checks the main checkout, not origin). `docs/deploy.md:31` names "use your SSH keys" in general; it does not say this undoes the sandbox's bound on other machines and on origin.
- Suggestion: hide `~/.ssh` from every job's agent, its install and a merge's checks, the way the env file is hidden: add it to `hidden()` and to `stepSandbox`'s hidden list (an ssh agent's socket is already out of reach: the sandbox opens no Unix stream socket); a job needs no SSH key, since Arthur itself pushes and fetches. Then `docs/deploy.md` and `spawn.md:116` say `~/.ssh` is hidden. A test: a sandboxed `cat ~/.ssh/<file>` of a temporary home answers `Permission denied`. Out: the network itself (a separate decision).
- Status: ticket AR0508

## F2. The sweep's copy from another machine has no size or time bound, so one machine stalls every job on it, or all of `arthur run`

- Kind: security
- Severity: medium
- Found by: 2026-10-27-worker-03ddbe1b (worker), 2026-10-27
- Where: `packages/core/src/job-machine.ts:114-122` (`ssh`: `spawnSync` with neither `maxBuffer` nor `timeout`), `packages/core/src/machine-sync.ts:57` (the copy), `:68` (`synced` moves only after a copy is written), `:37-50` (only exit 255 counts as offline), `packages/core/src/jobs.ts:128` (run in `arthur run`'s sweep, synchronously); `packages/core/src/wrapper.ts:137` (the agent's output goes into `log`)
- Input: the answer of `arthur remote-job records` on another machine: a job's log that grew by more than 1 MiB between two sweeps (the agent's whole JSON stream, an install's output), a large `result`; or a `records` that does not end (a machine whose network drops mid-call, a job there without a sandbox, such as on macOS, that changed Arthur's install there).
- Why the check misses it: `spawnSync`'s default `maxBuffer` is 1 MiB; past it Node kills ssh and sets `ENOBUFS` (probe: a 2 MiB stdout gave `status null signal SIGTERM error ENOBUFS`). `ssh` throws then, with no cause 255 (probe, the real `ssh()` with a fake `ssh` that prints 2 MiB: `thrown: machine mac: ssh: spawnSync ssh ENOBUFS | cause: undefined`), so the machine is neither copied nor held offline; `synced` is not moved, so the next sweep asks for the same bytes and fails the same way, every sweep. `ConnectTimeout=10` bounds only the connection: a `records` that never answers blocks `spawnSync`, and so `arthur run`'s whole event loop (Telegram, `/stopall`, every plugin) [INFERENCE: from the code, not run against a hanging machine].
- What: every job on that machine stays `working` here and never ends, its branch never fetched, its slot held; or Arthur stops answering altogether until the call ends.
- Suggestion: copy over `sshAsync` (as stop and continue already do) with a time limit, and a `records` answer cut to a byte budget: `records` sends at most N bytes of log per job and says where it stopped, so the next copy goes on from there; a timeout counts as unreachable (the grace applies). A test with a fake `remote-job records` that prints more than 1 MiB, and one that never ends.
- Status: ticket AR0509

## F3. The GitHub, Telegram and YouTrack API addresses take `http://` for any host, sending the token in the clear

- Kind: security
- Severity: low
- Found by: 2026-10-27-worker-03ddbe1b (worker), 2026-10-27
- Where: `packages/github/src/github-options.ts:31` (`apiUrl`), `packages/telegram/src/telegram-options.ts:21` (`apiUrl`; the token is in each request's path, `packages/telegram/src/bot-api.ts:43`, `:57`), `packages/youtrack/src/youtrack.ts:58` (the URL in `urlEnv`)
- Input: `arthur.config.ts` and the env file, both the owner's: a typo (`http://api.github.com`) or a self-hosted server given without TLS.
- Why the check misses it: each check accepts `http:` and `https:` alike, for any host; `http` is kept so tests reach their fake on loopback. Probe: `checkOptions` of github and telegram with `http://api.github.com` and `http://api.telegram.org` returned `[]`.
- What: the first request carries the bearer token or the bot token over the internet in plain text, before any redirect to https.
- Suggestion: accept `http:` only for a loopback host (`localhost`, `127.0.0.0/8`, `::1`), as a test's fake needs; refuse it otherwise with the option's path, as the youtrack refusal already words it. Out: a private-network GitHub Enterprise Server without TLS, which would need its own option.
- Status: ticket AR0510

## F4. The github plugin's docs offer a classic token with `repo`, which writes every repository of the account

- Kind: docs
- Severity: low
- Found by: 2026-10-27-worker-03ddbe1b (worker), 2026-10-27
- Where: `packages/github/docs/github.md:23`
- Input: the owner following the docs when he makes the token.
- Why the check misses it: the plugin needs only Actions: read (read and write for `arthur ci --rerun`) and Pull requests: read; the docs name the fine-grained token first but give "a classic one with `repo`" as equal, and the classic `repo` scope is full read and write of code, issues and settings on every repository the account reaches. Nothing in the plugin checks the token's scope.
- What: a token leaked from Arthur's process (AR0311's F17 kind of path, a coordinator transcript) pushes to any repository of the account, past `arthur merge`.
- Suggestion: drop the classic alternative from `github.md:23`, or name it as broader than needed and to be avoided; keep the fine-grained token's permissions as the only recipe, limited to the projects' repositories.
- Status: ticket AR0511
