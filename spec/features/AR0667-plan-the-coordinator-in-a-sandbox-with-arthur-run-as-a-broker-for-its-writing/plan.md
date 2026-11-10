# AR0667 - Plan

- Job: 2026-11-09-plan-84f8efdc
- Planned at: aca613602a313663851580785c70895f20248031

## Approach
This plan ticket delivers one file: this plan, filed as `plan.md` by `arthur ticket file`. No code changes. The worker who runs after approval edits nothing. It only runs the checks again.

The plan turns Option 3 of the AR0483 plan (steps a to e, approved as AR-D562) into six follow-up tickets, T1 to T6. Step (c) becomes two tickets, T3 and T4. The first three can start at once, since AR0664 is merged. The sandbox ticket (T5) waits for T1 to T4. Before T5, the coordinator must be able to do its daily work without writing the config or running `git commit`.

What the owner gets at the end: the coordinator runs in the same Landlock and seccomp sandbox that jobs use (`packages/core/src/job-sandbox.ts`). It writes only:
- Arthur's home;
- each main checkout's `spec/` (never `.git`);
- the temporary folder, `/dev` and `~/.omp`.

It cannot read the env file, `~/.ssh`, or the credentials Git and `gh` keep. Every `arthur` command it runs is handed to `arthur run`, which runs it with the full rights the coordinator has today.

What stays the same:
- the jobs' sandbox, the worktree guard and the env guard;
- `arthur merge` and its gates;
- how decisions are asked and recorded;
- Option 2 (a guard mode for the coordinator), which is not built.

Three design points differ from the AR0483 plan's text:
- **Commands that read a file the caller names.** The AR0483 plan kept `send`, `transcribe` and a Dokploy upload inside the sandbox. They cannot run there, because their tokens live in the env file the sandbox hides. The plan follows Option 1 under Not available directly.
- **Every command goes to the broker.** The coordinator's CLI forwards every command, reads included, to `arthur run`. It never loads `arthur.config.ts` inside the sandbox, where the hidden env file would make the load refuse (`packages/core/src/env.ts:131-134`).
- **Turning a plugin on (step a).** A command cannot edit `arthur.config.ts`, which is TypeScript code, without a parser of a file the owner writes (the styleguide's Avoid list). So step (a) is a JSON switch file read by the core. This follows Open question 1's recommendation.

The tickets, in order:

**T1: (a) `arthur config on|off <plugin>`.** Order: none; starts now. Cost: about 1 day, roughly +50 lines in the core, so the core's line budget is raised.
- The command writes `arthur.plugins.json` beside `arthur.config.ts`: `{ "<plugin>": true | false }`. It writes a temporary file and renames it.
- The host applies each entry over the `enabled` of a plugin the config already lists (`checkPlugins` in `packages/core/src/host.ts`, where `plugin.options?.enabled` is read).
- Refused:
  - a name the config does not list (`ask the owner to add it to arthur.config.ts`);
  - `off` for `orchestration`;
  - a switch file broken by hand, which refuses the load and names the file.
- Every option of every plugin stays the owner's edit.
- The coordinator's role changes: "turn a plugin on in arthur.config.ts and restart" becomes `arthur config on <name>`, then `arthur restart`.

**T2: (b) board commits by command.** Order: none; starts now. Cost: about 1 day, +60 lines in delivery and +10 in projects, both budgets raised.
- Delivery gets `arthur commit-board '<subject>' [--project <name>]`. It commits only `spec/build.json`, `spec/decisions.jsonl` and the `.md` files under `spec/features/`, and never a symlink. Every other change in the checkout, staged or not, stays as it was.
- It makes the commit the way `settleTicket` in `packages/delivery/src/merge-outcome.ts:76-88` already commits `spec:` on main:
  - `checkConfig(root)` first;
  - hooks off;
  - the project's `commit-msg` script through `vetted`, which is exported for this;
  - `git commit -m <subject> -- <paths>`.
- `arthur init` (`packages/projects/src/init.ts`, which says today that it "commits nothing") commits the files it created. Some of them (`.agents/arthur/criteria/*`, `.nvmrc`) lie outside `spec/`, where the sandboxed coordinator could no longer commit them.
- The role and procedures that say "commit" now name the command: `coordinator.md`, `coordinator/plan-ended.md`, `docs/commands/plan.md`, `decision.md` and `init.md`.

**T3: (c1) the broker.** Order: none; starts now. Cost: about 2 days, roughly +150 lines in the core, budget raised.
- **The coordinator's side.** `supervise` (`packages/orchestration/src/coordinator.ts`) adds `-e ARTHUR_BROKER=<home>/broker` to the agent's `tmux new-session` environment. When that variable is set, `main` in `packages/core/src/cli.ts` does not load the config:
  - it writes `{ argv }` to `<home>/broker/requests/` (temporary name, then rename);
  - it streams the result's `out` and `err` files;
  - it exits with the command's exit code.
- **`arthur run`'s side.** A new file, `packages/core/src/broker.ts`, started and stopped in `packages/core/src/run.ts`, claims each request and runs it:
  - `node <core cli> ...argv` in the config folder, never through a shell, with no stdin;
  - no variable from the request; it sets `ARTHUR_ORCHESTRATION_FOLDER=<home>/orchestration` itself, so `actor` (`packages/orchestration/src/actor.ts`) still names the coordinator;
  - detached, in a systemd scope of its own where a user manager makes one, as `pass-forward.ts` does (AR0629), so a restart does not cut a merge in half;
  - output and exit status in `<home>/broker/runs/<id>/`, which the next `arthur run` picks up.
- `run` and `attach` are refused. Finished runs are removed after 7 days, as the inbox's are.
- `command-ran` is logged once, by the brokered process.

**T4: (c2) commands that read a file the caller names.** Order: after T3. Cost: about 1.5 days, +60 lines in the core and +2 to 10 in each marked plugin, budgets raised.
- `Command` (`packages/core/src/commands.ts`) gets `reads?: (args) => boolean`, checked at registration as `inJob` is. It answers true when that call reads a file the caller names. Marked:
  - `send`;
  - `transcribe`;
  - `dokploy upload` and `dokploy setup --dockerfile/--context`;
  - `github issue|pr create|comment <file>`;
  - each `youtrack` verb that takes a file.
- `github branch delete`, which needs Git's own credentials, answers false.
- The broker runs a marked call through `sandboxed()` of `job-sandbox.ts`:
  - it writes only the home, the temporary folder and `/dev`;
  - it hides the env file and `unread()` (exported for this);
  - the secrets come on the CLI's stdin, never in its environment, because `send /proc/self/environ` would carry the environment.
- A CLI started this way reads its variables from stdin, not from the env file.

**T5: (d) the coordinator in the sandbox.** Order: after T1, T2 and T4. Cost: about 2 days, +60 lines in the core, +25 in orchestration and a little in core/testing, budgets raised.
- The core publishes a Host member, `coordinatorSandbox(note)`, built in a new `packages/core/src/coordinator-sandbox.ts` from `sandboxed()`.
  - Writable: every entry of the home, each main checkout's `spec/` (from `board.projects()`), the temporary folder, `/dev`, `~/.omp`, and a cache folder of its own set as `cached()` sets one, so an MCP server started with `npx` works.
  - Hidden: the env file and `unread()`.
- `supervise` wraps the agent's command line in it.
- A host where it cannot be set up refuses the coordinator's start unless the owner opts in (Open question 2). It says why in `arthur run`'s log and in a `notice` to the channels.
- The `sandbox` requirement of `arthur doctor` (`packages/core/src/requirements.ts:116-119`) names the coordinator in what it costs.
- The coordinator's role says what it no longer does: edit the config, `git commit`, `ssh`, `systemctl --user`, docker, tmux, `gh`.

**T6: (e) docs.** Order: after T5, and after AR0666 is merged. Cost: half a day, no code.
- `docs/deploy.md`, "Threat model": the coordinator bullet AR0666 adds says what the sandbox now bounds and what it leaves open. "Code reaches main only through `arthur merge`" then holds for the coordinator too.
- `docs/setup.md`: `python3` and Landlock are now needed for the coordinator too, and `arthur.plugins.json` is described.

## Not available directly
- **The AR0483 plan's step (c) keeps the commands that read a file the caller names (`send`, `transcribe`, a Dokploy upload) inside the coordinator's sandbox. They cannot run there.** Each needs a token from the env file, which the sandbox hides. The CLI refuses its load when that file cannot be read (`readEnvFile` in `packages/core/src/env.ts:131-134`), and `arthur send` sends from the CLI's own process through each channel plugin (`packages/core/src/send-command.ts`). There are also more such commands than the AR0483 plan names: `github issue|pr create|comment <file>`, `youtrack` create and update, `dokploy setup --dockerfile`.
  - Option 1: the broker runs a marked call under the same read limits as the coordinator, with the secrets on its stdin - cost about 60 core lines and a `reads(args)` mark per command, risk: a marked command that also needs `~/.ssh` (`github branch delete`) must answer false, or it fails.
  - Option 2: the sandboxed CLI copies each named file into the request folder and the broker reads only the copies - cost: each command must say which arguments are files, and the broker needs symlink and hard-link checks, risk: a copy swapped between the check and the read (a time-of-check race).
  - Option 3: let the coordinator's sandbox read the env file - cost none, risk: the coordinator holds the GitHub token that can push, which undoes the sandbox.
  - Recommendation: Option 1 (T4).
- **Landlock cannot let a process create only some file names in a folder.** The board is written by a temporary file and a rename into `spec/` (`writeBoard` in `packages/core/src/board-file.ts:65-68`), so the coordinator must be able to write all of `spec/`. T2 limits what `commit-board` commits to the board's files, so anything else the coordinator leaves in `spec/` is never committed by it.

## Files
- `spec/features/AR0667-plan-the-coordinator-in-a-sandbox-with-arthur-run-as-a-broker-for-its-writing/plan.md`: this plan, written by `arthur ticket file`. No other file changes in this ticket.
- Files for the follow-up tickets, for their own planning:
  - T1: `packages/core/src/host.ts`, a new `packages/core/src/plugin-switch.ts`, `packages/core/src/core-commands.ts`, `packages/core/docs/commands/config.md`, `.gitignore`, `arthur.config.example.ts` (its rules header), `packages/orchestration/roles/coordinator.md`, `test/structure.test.ts` (core budget), core tests.
  - T2: a new `packages/delivery/src/commit-board.ts`, `packages/delivery/src/merge-outcome.ts` (export `vetted`), `packages/delivery/src/delivery.ts`, a new `packages/delivery/docs/commands/commit-board.md`, `packages/projects/src/init.ts`, `packages/projects/docs/commands/init.md`, `packages/orchestration/roles/coordinator.md`, `packages/orchestration/roles/coordinator/plan-ended.md`, `packages/orchestration/docs/commands/plan.md` and `decision.md`, budgets, tests in delivery and projects.
  - T3: `packages/core/src/cli.ts`, a new `packages/core/src/broker.ts` (and a new `broker-client.ts` if `cli.ts` would grow past green), `packages/core/src/run.ts`, `packages/orchestration/src/coordinator.ts`, `packages/core/docs/commands/run.md` and `help.md`, `packages/orchestration/docs/commands/coordinator.md` (step 4), budgets, core tests.
  - T4: `packages/core/src/commands.ts`, `broker.ts`, `env.ts`, `job-sandbox.ts` (export `unread`; it is at 215 counted lines, yellow, so it may add at most 5), `send-command.ts`, `packages/listen/src/transcribe-command.ts`, `packages/dokploy/src/dokploy-command.ts`, `packages/github/src/github-command.ts`, `packages/youtrack/src/youtrack-command.ts`, `docs/plugin-api.md` (`Command.reads`, a "Changes since entry 51" line), each marked command's page, tests.
  - T5: a new `packages/core/src/coordinator-sandbox.ts`, `packages/core/src/plugin-host.ts`, `packages/core/src/plugin.ts`, `packages/core/src/testing.ts` (the fake host's member), `packages/core/src/requirements.ts`, `packages/orchestration/src/coordinator.ts` and `orchestration.ts`, `docs/plugin-api.md`, `packages/orchestration/docs/commands/coordinator.md`, `packages/core/docs/commands/doctor.md`, `packages/orchestration/roles/coordinator.md`, tests.
  - T6: `docs/deploy.md` ("Threat model"), `docs/setup.md`.

## Risks
- **Every package these tickets touch is at its line budget now.** I counted core 7850 = 7445 + 405 (core/testing), and orchestration 2829, delivery 2243, session 953 and develop 760, each equal to its budget in `test/structure.test.ts`. Each ticket's merge raises its package's budget and says so in `outcome.md`.
- **The sandbox without T1 closes nothing.** `arthur.config.ts` is code that every brokered command imports (`packages/core/src/config.ts:56`). T5 waits for T1 and keeps the config folder and `projects/*/project.config.ts` read-only. Only the brokered `arthur config` writes `arthur.plugins.json`.
- **The broker is a new way into full rights.** It runs only the core's CLI, with the argv as a list, never through a shell, in the config folder. It passes no variable from the request, so a `NODE_OPTIONS` or a `GIT_SSH_COMMAND` the coordinator sets never reaches the command. The only processes that can write requests are:
  - the coordinator;
  - Arthur's user outside any sandbox, who can run `arthur` anyway.

  A job cannot: its sandbox hides the home except its record (AR0590), and a merge step writes only its checkout and cache. T3's tests prove an argv like `$(touch x)` stays text.
- **The broker could reopen reads.** T4 runs each marked call under the coordinator's own hidden paths. The secrets go on stdin, not in the environment, because `/proc/self/environ` is readable by the process itself. A test sends `/proc/self/environ` and finds no secret in it.
- **The coordinator can still forge the owner's word by hand.** The inbox extension moves files between `inbox/queued`, `turn` and `answered` inside the agent's own process (`packages/orchestration/src/inbox-extension.ts:52-73`), so the sandbox must leave `<home>/orchestration/inbox/` writable. AR0664's proof reads exactly those files (`proof` in `packages/orchestration/src/decision-proof.ts`). So a forged `inbox/turn/<seq>-<ms>` holding `AR-D12 yes` passes a brokered `decision answer`. The AR0483 plan already says forged decisions stay open. Open question 3 offers a T7 that closes it.
- **A restart of `arthur run` would kill a brokered merge if it ran in the service's cgroup.** T3 runs each request in a scope of its own, as `pass-forward.ts` does, and the next `arthur run` reads its result. A merge killed anyway is rolled back by `merge-recovery.ts`.
- **Every `arthur` call and every turn get slower.** The context extension runs `arthur coordinator context` before each turn, and that call now goes through the broker too. T3 checks requests often (100 ms or `fs.watch`) and states the time a round trip takes, measured.
- **`spec/` of every main checkout becomes writable to the coordinator.** In a project whose tests live in `spec/` (RSpec), a file the coordinator leaves there is untracked. The merge's dirt check ignores untracked files (`git status --porcelain --untracked-files=no`, `packages/delivery/src/merge-command.ts:107`), so the merge's checks on main run that file, inside their own sandbox. That is no more than a job's branch can do. `commit-board` never commits it.
- **What the coordinator loses in T5 can surprise the owner:**
  - `systemctl --user`, docker, tmux and any other daemon reached through a Unix stream socket;
  - `ssh` and `gh`;
  - `npm install` in a main checkout.

  Things that should still work, unconfirmed:
  - The headless Chrome page check of `.agents/arthur/criteria/report.md`: the seccomp filter refuses only `socket()` for Unix sockets other than datagram ones, not `socketpair` (`job-sandbox.ts`, the SCRIPT) [INFERENCE: it works as it does in jobs; T5's smoke run checks it].
  - omp writing only `~/.omp`, as it does in jobs [INFERENCE].
- **Tests need Landlock and `python3`.** Sandbox tests are skipped on a bare host, as `packages/core/test/sandbox.test.ts` does (`{ skip: bare }`). The broker tests of T3 do not need the sandbox.
- **Project agents (AR0669, roadmap 85 to 88) are coordinator-like.** Their plan should start them through `coordinatorSandbox` and the broker.
- **AR0666's new bullet becomes partly untrue after T5.** T6 rewrites it, and waits for AR0666 to be merged.

## How to test
- **Done means 1** (`plan.md` holds the follow-up tickets for steps a to e, each with its files, order and cost, and the open questions put to the owner):
  - after filing, `arthur plan AR0667` prints this file;
  - T1 to T6 under Approach give each one's files, `after` and cost; Files lists their paths;
  - Open questions holds the two questions of the AR0483 plan, plus T7.
- **Done means 2** (no code; `npm test` and `npm run check` pass):
  - `git diff --stat` after filing shows only `plan.md`.
  - At HEAD `aca61360` of this checkout, `npm run check` (tsc) finished clean in 6 s.
  - At the same HEAD, `npm test` gave 1676 tests: 1612 passed, 0 failed, 64 skipped, in 538 s.
  - The worker runs both again after filing, each in one call with a timeout of 1800 s (3600 s for `npm test`).
- **For the follow-up tickets** (their own Done means will hold these):
  - T1: on and off flip a listed plugin; an unlisted name, `off orchestration` and a hand-broken switch file are refused; the switch wins over `enabled: false`.
  - T2: only board paths are committed; other staged or changed files stay as they were; a symlink, a `checkConfig` refusal and a refusing `commit-msg` each stop the commit; `arthur init`'s files are committed.
  - T3: argv in, output and exit code back; no shell; a pending request finishes after an `arthur run` restart; `run` and `attach` are refused.
  - T4: `arthur send <a file under a fake ~/.ssh>` is refused by the read limits; a readable file is sent; the token reaches the command; `/proc/self/environ` holds no secret.
  - T5: the fake agent cannot write the config, a main checkout's `.git` or the install, and cannot read the env file or `~/.ssh`; it can write the home and `spec/`; `arthur board` works through the broker; on a host without a sandbox, the start is refused unless the owner opted in.

## Open questions
- **(a) How does turning a plugin on work once the coordinator can no longer write `arthur.config.ts`?** This changes AR0329's decision that the coordinator itself edits the config and restarts.
  - Recommended: `arthur config on|off <plugin>`, for a plugin the config already lists. The owner adds a new plugin's entry once, with its options and `enabled: false`; the coordinator then turns it on. About 50 core lines.
  - Or: the command also adds a package of Arthur's own install that the config does not list, with its default options. About 80 lines; the core then imports a plugin package by name.
  - Or: no command; every config change, turning plugins on included, is the owner's own edit. No code.
- **On a host where the sandbox cannot be set up (no Landlock, no `python3`, macOS), what does the coordinator do?**
  - Recommended: refuse to start unless `core.jobs.unsandboxed: true` is set; the one existing switch then covers jobs and the coordinator.
  - Or: refuse unless a new option, `orchestration.coordinator.unsandboxed: true`, is set.
  - Or: start without the sandbox, with a warning to the channels.
- **Add T7 now?** T7: `arthur decision answer` checks the owner's words against the `message-received` event in `<home>/events.jsonl`, not the inbox copy, and the coordinator's sandbox keeps that log read-only. That closes forged answers, which the sandbox alone leaves open (Risks). About 1 day, in orchestration and the core.