# Inventory: everything the harness does today, mapped to Arthur

> Draft of 2026-10-16 (K0254). Written from the files of this repository at that date, so the move to Arthur can be planned module by module and nothing is lost at the switch. Plugin names are those of `spec/next/vision.md` on the K0253 branch (`h/2026-10-16-k0253-plugin-harness-vis-13fda944`); this ticket did not edit it. "Today" is the harness that runs in this repository.

## How to read it

Arthur home is one of:

- `core`: always on (config loader, plugin host, job runner, ticket board, event stream, env guard of the vision).
- A plugin of the vision: `orchestration`, `projects`, `youtrack`, `telegram`, `schedule`, `delivery`, `github`, `manage`, `develop`, and the later ones (`webhooks`, `whatsapp`, `signal`, `server`).
- `session`: a plugin the vision does not have. Today's harness needs it (compaction, the daily fresh start, the restart guard); Gap G1 proposes it.
- `drop`, with the reason.

A file can be in several rows when it does several jobs; the home of each job is what counts. A row's Tests column names the test files that exercise it today; "none" means no test file imports or names it (found by searching `test/`; a behavior a test reaches only through the CLI may be missed). Facts come from the files named in the row; nothing here was run except the check at the end.

How a plugin carries its own parts, wherever a row says so: its commands (with the `docs/commands/<cmd>.md` that `h <cmd> --help` prints), its role file or procedure from `roles/`, its tests, and its options.

## 1. Command line and the job runner

| # | What it does today | Files | Tests | Arthur home |
| --- | --- | --- | --- | --- |
| R1 | The `h` program: finds the command, prints `h <cmd> --help` from the command's doc, runs it. `--repo <path>` after a command runs it on another repository; for `spawn` and `merge` it also remembers the harness checkout the command belongs to. When started with the two internal variables it is the wrapper of one job instead. Refuses to run inside an `h eval` session. | `bin/h`, `src/main.ts`, `src/help.ts` | `test/help.test.ts`, `test/repo.test.ts`, `test/structure.test.ts` | core (the eval refusal goes to `develop`; `--repo` becomes "act on this project", the project list coming from `projects`) |
| R2 | Start a job: a worker on its own branch and worktree from HEAD, or a read-only job (review, audit, retro, plan, plan review) in a detached checkout. Writes the job record `.h/jobs/<id>/` (task, label, model, thinking, smol, timeout, budget, kind, branch, root, worktree), checks that the `Ticket:` files are in the worktree, copies `node_modules` when the lockfile is the same, moves the ticket's status, returns the id in about a second. | `src/commands/spawn.ts`, `src/spawn-job.ts`, `src/launch.ts`, `src/job.ts`, `src/check-tickets.ts`, `src/node-modules.ts` | `test/spawn.test.ts`, `test/status.test.ts`, `test/review.test.ts`, `test/continue.test.ts` | core (what each kind of job is told moves to its plugin: R2 rows below) |
| R3 | The wrapper: one background process per job. Starts `omp` with the role's tools (worker: read, edit, write, bash, grep, glob; all other kinds: no edit or write), model, thinking level, smol model and system prompt; loads the env guard and the worktree guard (and the steering hook for workers); writes `state`, `pid`, `log`, `result`, `cost`, `tool-calls`, `activity`, `checks`, `commits`, the verdict; moves the ticket at the end. | `src/wrapper.ts`, `src/stream.ts`, `src/checks.ts` | `test/wrapper.test.ts`, `test/fake-omp.test.ts` | core |
| R4 | Time and money limits: `timeout` (H_JOB_TIMEOUT, 120 min), budget in USD (H_JOB_BUDGET 2; audit H_AUDIT_BUDGET 10; plan H_PLAN_BUDGET 5; 0 is no limit), the one automatic resume of an audit, retro or plan stopped by budget or time with the budget doubled. | `src/job-limits.ts` | `test/audit.test.ts`, `test/plan.test.ts`, `test/spawn.test.ts` | core (the per-kind budgets are options of the plugin that owns the kind: `manage`, `orchestration`) |
| R5 | One systemd scope per job inside one `h-jobs.slice` with a joint CPU and memory limit (H_JOBS_CPU, H_JOBS_MEMORY), so a job cannot starve the coordinator; every process a job leaves behind is killed at its end. Runs bare, with a log line, where there is no user manager (macOS). | `src/job-scope.ts`, `deploy/user@.service.d/delegate.conf` | `test/job-scope.test.ts` | core |
| R6 | Stop: SIGTERM to the job's group, SIGKILL after a grace, then strays that left the group, then everything left in the scope. | `src/commands/stop.ts`, `src/stop-job.ts`, `src/descendants.ts` | `test/stop.test.ts` | core |
| R7 | Continue: resume a finished worker or onboarding in place (same id, branch, worktree, omp session) with one more instruction; `--budget` replaces the old one. | `src/commands/continue.ts`, `src/continue-job.ts` | `test/continue.test.ts` | core |
| R8 | Steer: one correction for a running worker, delivered after its next tool call; an undelivered one is moved aside and named in the wake message. | `src/commands/steer.ts`, `src/steer-job.ts`, `hook/steering.ts` | `test/steer.test.ts` | core |
| R9 | List jobs, grouped like the board, one line each; jobs of every project; the short id by which a job is addressed. | `src/commands/jobs.ts`, `src/jobs-listing.ts` | `test/jobs.test.ts` | core |
| R10 | Prune: free the worktree, branch and `.h/jobs/<id>` of finished jobs; git decides what is safe, a review of an unmerged branch stays (the 2-FAIL limit counts its record). | `src/commands/prune.ts`, `src/prune-jobs.ts` | `test/prune.test.ts` | core (which jobs to prune after a merge is `delivery`'s procedure) |
| R11 | Git helpers: worktree add and remove, branches, merge base, commit lists, `run`. | `src/git.ts` | `test/prune.test.ts`, `test/review.test.ts` | core |
| R12 | Find a dead job: a job whose wrapper and group are gone on two sweeps in a row is failed with `process gone` (killed with the service, OOM, reboot). | `hook/wake.ts` | `test/wake.test.ts` | core (a job-runner check; today it sits in the coordinator's wake hook) |
| R13 | Read a setting: a shell variable wins over `.env` at the repository root, even empty; `H_PATH_PREPEND` goes in front of `PATH` for jobs, `h review-needed` and `h merge`. | `src/env.ts` | none of its own (used by most tests) | core (replaced by the config loader and `ARTHUR_<PLUGIN>_<WHAT>`) |
| R14 | Role prompt: the harness's role file, a project's override in `.agents/harness/roles/`, then each present criteria file as `## <title> (<path>)`; a symlinked override or criteria file is never read; a missing criteria file warns; a missing role file blocks the spawn. The preamble stays in the job. `h roles` prints the table. | `src/roles.ts`, `src/commands/roles.ts`, `.agents/harness/README.md` | `test/roles.test.ts` | core (each plugin ships its own role files and procedures) |
| R15 | The role file every job shares: how a worker works, its Never list, its final message. | `roles/worker.md` | `test/roles.test.ts` | core |
| R16 | Env guard: a call that names a secrets file (`.env`, not `.env.example`) is refused in the coordinator and in every job, down to quoting, expansion and options that carry the name; one `sed -i` that sets a key without printing is allowed. | `hook/env-guard.ts` | `test/env-guard.test.ts` | core (the vision's env guard) |
| R17 | Worktree guard: in every job, a file tool or bash command that writes into the main checkout, `.h/`, or another job's worktree is refused (redirects, writing commands, `git` writes, `cd` there, symlinks, `git stash`). Reading passes. Its shell parser is shared. | `hook/worktree-guard.ts`, `hook/shell-commands.ts` | `test/worktree-guard.test.ts`, `test/shell-commands.test.ts` | core (Gap G2: the vision's core table does not name it) |
| R18 | Wiring: OMP discovers one extension that loads the coordinator's hooks (env guard, context, wake, schedule, compact, telegram). | `.omp/extensions/h.ts` | `test/coordinator.test.ts` | drop (the plugin host loads each enabled plugin; no stub file) |
| R19 | Docs of every command, printed by `h <cmd> --help` and `h help <cmd>`; a test keeps commands and docs equal. | the 20 files of `docs/commands/` (listed in section 5) | `test/structure.test.ts`, `test/help.test.ts` | core (each plugin's commands carry their own docs: Gap G9) |

## 2. The ticket board

| # | What it does today | Files | Tests | Arthur home |
| --- | --- | --- | --- | --- |
| B1 | Tickets as folders `spec/features/<id>-<slug>/` with `ticket.md`, `plan.md`, `plan-review-N.md`, `findings.md`, `review-N.md`, `outcome.md`; the template folder defines them. The board is `spec/build.json`, changed only through `h ticket`; statuses planning, planned, in-progress, review, done, merged, dropped; `planned` refuses template guidance left in. Telegram and the coordinator read the same files. | `src/board.ts`, `src/commands/ticket.ts`, `spec/build.json`, `spec/features/`, `spec/features/_template/` | `test/ticket.test.ts`, `test/ticket-file.test.ts`, `test/status.test.ts` | core (ticket board) |
| B2 | One writer at a time: a lock directory on the board file, taken over from a dead pid. | `src/board-lock.ts` | `test/board-lock.test.ts` | core |
| B3 | Ticket ids with a per-repository prefix (K here, 2 to 6 capitals elsewhere); `.agents/harness/project.json` holds `prefix`, `ci`, `automerge`. | `src/ticket-id.ts` | `test/init.test.ts` | core (the prefix; `ci` goes to `github`, `automerge` to `projects`) |
| B4 | `after`: a ticket waits for other tickets; no cycle, no unknown or dropped id; `h merge` names what a merge unblocks. | `src/ticket-after.ts` | `test/ticket.test.ts` | core |
| B5 | Statuses follow jobs: spawn and continue set in-progress, a review sets review, its verdict sets done or in-progress, "no review" sets done, merge sets merged; merged and dropped stay. | `src/board.ts` (`moveTicket`) | `test/status.test.ts` | core |
| B6 | The worker's worktree must hold every `Ticket:` file the task names; a ticket that needs a plan also needs its approved `plan.md`. | `src/check-tickets.ts`, `src/plan.ts` | `test/spawn.test.ts`, `test/plan.test.ts` | core (the plan part: `orchestration`) |
| B7 | `h ticket file` of a review: the next `review-N.md`, never filed twice. | `src/board.ts` (`fileResult`), `src/job.ts` (`refuseFiled`) | `test/ticket-file.test.ts` | `delivery` |
| B8 | `h ticket file` of an audit or a retro: `spec/quality/YYYY-MM-DD.md` or `spec/retro/YYYY-MM-DD.md` with the commit audited or reviewed; a failed job is never filed. | `src/file-audit.ts`, `src/file-retro.ts`, `spec/quality/`, `spec/retro/` | `test/audit.test.ts`, `test/retro.test.ts` | `manage` |
| B9 | `h ticket file` of a plan or a plan review: `plan.md` replaced (history stays in git), `plan-review-N.md` added. | `src/plan.ts` | `test/plan.test.ts` | `orchestration` (Gap G5) |
| B10 | `h ticket status <id> planned --autopilot`: pre-approval of a ticket from an audit or a finding, kind bug or cleanup, at most 3 Scope files, none on the always-review list, a budget above 0; records `Pre-approved by policy`. | `src/autopilot.ts`, `.agents/harness/criteria/autopilot.md` | `test/autopilot.test.ts` | `orchestration` (autopilot budgets are its options) |
| B11 | The board digest in the coordinator's prompt and the audit task: every open ticket and the 10 newest merged, one line for the rest. | `src/board.ts` (`boardDigest`) | `test/ticket.test.ts`, `test/coordinator.test.ts` | core (the digest); `orchestration` puts it in the prompt |
| B12 | The vision file of each project: written by the human, read by the coordinator, the auditor, the planner and the onboarding. | `spec/vision.md` | `test/structure.test.ts` (line limit) | core (a file of each project, read by plugins) |

## 3. Orchestration: the coordinator

| # | What it does today | Files | Tests | Arthur home |
| --- | --- | --- | --- | --- |
| O1 | The coordinator's role: commands, ticket and board rules, hand-off rules, Telegram and restart rules, "when a job ends" steps, the final message (Polish, at most 5 lines), the standing rules (at most 3 jobs at once, weekly retro, nightly audit, autopilot on), its Never list. | `roles/coordinator.md` | `test/structure.test.ts` (200 lines and a character ceiling), `test/coordinator.test.ts` | `orchestration` |
| O2 | The coordinator's prompt on every turn: role, vision, styleguide, a warning per missing criteria file, board digest, whether a restart is due, whether a retro is due, local time and whether it is night. | `hook/context.ts` | `test/coordinator.test.ts`, `test/eval.test.ts` | `orchestration` (restart line from `session`, retro line from `manage`, night from core config: Gap G4) |
| O3 | Wake on job end: a footer while jobs run; one message per sweep for jobs that ended (state, result's first 15 lines, the procedure for audit, retro, onboarding, plan, plan review), jobs of other repositories named; a failed send is retried and the third failure is told; claimed only after sending. | `hook/wake.ts` | `test/wake.test.ts`, `test/status.test.ts`, `test/stop.test.ts` | `orchestration` (today it polls `.h/jobs/` every second; Arthur subscribes to the core's job-ended event) |
| O4 | After a restart: one `Restarted.` message with the steps in `.h/after-restart.md` and every `h health` line. | `hook/wake.ts` | `test/wake.test.ts` | `session` (`after-restart.md`), `manage` (health lines) |
| O5 | Procedure after a merge that went in: findings into `findings.md` and tickets, `outcome.md` rewritten, commit, push, prune, start unblocked tickets. | `roles/coordinator/after-merge.md` | `test/structure.test.ts`, `test/roles.test.ts` | `delivery` |
| O6 | Procedure when an audit ends: file it, tickets from proposals, autopilot, commit, prune; reply starts `audit done: N tickets`. | `roles/coordinator/audit-ended.md` | same | `manage` |
| O7 | Procedure when a retro ends: file it, tickets, the phone page `spec/retro/<date>.html`, commit, prune. | `roles/coordinator/retro-ended.md` | same | `manage` |
| O8 | Procedure when an onboarding ends: send questions or show the drafts, review, merge on the human's word. | `roles/coordinator/onboarding-ended.md` | same | `projects` |
| O9 | Procedure when a plan or a plan review ends: file, send five lines, the human's "ok", re-plan on request. | `roles/coordinator/plan-ended.md` | same | `orchestration` (Gap G5) |
| O10 | Procedure when a branch has two FAIL reviews: file them, recommend, the human decides the third round. | `roles/coordinator/review-limit.md` | `test/review-limit.test.ts` | `delivery` |
| O11 | Procedure for the 08:00 morning report: built overnight, merged without you, waiting for approval, waiting for a decision, needs attention. | `roles/coordinator/morning-report.md` | `test/schedule.test.ts` | `orchestration` (reads `manage`'s health, `delivery`'s merges) |
| O12 | Which coordinator rules are code and which are prose: "at most 3 jobs" is a sentence in `roles/coordinator.md`; code enforces the 3 only for the automatic steps after a FAIL review (`MAX_JOBS` in `src/hand-back.ts`). No code stops a fourth job from a human's or the coordinator's `h spawn`. | `roles/coordinator.md`, `src/hand-back.ts` | `test/hand-back.test.ts` | `orchestration` (option `maxAgents`, enforced) |
| O13 | Models and thinking: `H_MODEL_<ROLE>`, `H_THINKING_<ROLE>` for coordinator, worker, reviewer, auditor, retro, onboarding, planner; `H_MODEL_SMOL`, `H_THINKING_SMOL`; defaults (reviewer Sonnet, auditor and retro Opus); an invalid thinking level refuses before a job record exists; `--model` wins. | `src/roles.ts`, `src/commands/roles.ts` | `test/roles.test.ts`, `test/coordinator.test.ts` | `orchestration` |
| O14 | Plan flow for a large ticket: `- Plan: tak` under Goal, `h spawn --plan` (read-only planner), `h spawn --plan-review`, the human's "ok", then a worker with a `Plan:` line. | `roles/planner.md`, `src/plan.ts`, `src/spawn-job.ts` | `test/plan.test.ts` | `orchestration` (Gap G5) |

## 4. Delivery, GitHub, manage, projects, develop

| # | What it does today | Files | Tests | Arthur home |
| --- | --- | --- | --- | --- |
| D1 | Review: a read-only job on a fresh model judges a branch (`PASS` or `FAIL`, last line only); the verdict moves the ticket; no verdict fails the job; the branch is pushed to origin for CI. At most 2 FAILs since the last PASS, then `--round N`. | `src/review.ts`, `roles/reviewer.md`, `.agents/harness/criteria/review.md` | `test/review.test.ts`, `test/review-limit.test.ts`, `test/status.test.ts` | `delivery` |
| D2 | `h review-needed`: decides review or "no review" from the always-review list, deleted files, `.env` text, docs-only changes, small branches with passing checks; the verdict is recorded and the ticket moved. The always-review list: code that stops or deletes jobs, moves main, holds a secret; hooks, deploy, bin, `.omp/`, the review and autopilot policy. | `src/commands/review-needed.ts`, `src/review-rules.ts` | `test/review-needed.test.ts` | `delivery` |
| D3 | `h merge`: reads CI, files reviews, merges into main, runs install and checks, turns open findings into planning tickets, writes `outcome.md`, sets merged, rebuilds `CHANGELOG.md`, names unblocked tickets; a failed check resets main; `--auto` merges only after PASS on the tip, CI passed, no held path (roles, vision, CI, `package.json`, project file, always-review list); `--no-ci`, `--unreviewed` on the human's word. | `src/commands/merge.ts`, `src/merge-branch.ts`, `src/merge-checks.ts`, `src/finding-tickets.ts` | `test/merge.test.ts` | `delivery` |
| D4 | After a FAIL review: file it, send the findings to the worker with a new budget, spawn the next review when the worker ends; cancelled by `/stopall`; at most 3 running jobs. | `src/hand-back.ts` | `test/hand-back.test.ts` | `delivery` |
| D5 | `CHANGELOG.md` rebuilt from merged tickets, grouped by day and kind. | `src/commands/changelog.ts`, `src/changelog.ts`, `CHANGELOG.md` | `test/changelog.test.ts` | `delivery` |
| GH1 | CI of the branch and of main: the workflow run named in `project.json` (`macOS`) for a commit, walking back past commits that touch no watched path; `h ci` tells why a run failed (failed step, end of the log) and `--rerun` reruns a failed or cancelled run once. Needs `H_GITHUB_ACTIONS_TOKEN`. | `src/commands/ci.ts`, `src/ci.ts`, `src/ci-failure.ts` | `test/ci.test.ts`, `test/merge.test.ts` | `github` |
| GH2 | Push the reviewed branch and main to origin so the macOS run starts; one warning line when it fails, never a prompt. | `src/git.ts` (`pushOrigin`) | `test/review.test.ts` | `github` (core keeps the git helpers) |
| GH3 | The repository's own CI: macOS run of `npm run check` and `npm test` for `main` and `h/**`. | `.github/workflows/ci.yml` | none | drop (a file of the Arthur repository, not a capability; its name is the github plugin's `ci.workflow` option) |
| M1 | `h health`: one line per thing that should have happened by now and has not: unreviewed worker, unfiled review, audit, retro or plan, unblocked planned ticket without a job, stalled ticket, unmatched `Ticket:`, unpruned job, merged ticket with template text left in `outcome.md`, unpushed main, missed schedule slot, board uncommitted for an hour, `/tmp` full of `h-*` folders, low inodes. Reads only. | `src/commands/health.ts`, `src/health.ts`, `src/health-jobs.ts` | `test/health.test.ts` | `manage` |
| M2 | `h stats`: per merged ticket, review rounds, verdicts, cost, days; mean rounds, first-round PASS share, autopilot share, the 3 dearest, the first line of each FAIL finding. | `src/commands/stats.ts`, `src/stats.ts` | `test/stats.test.ts` | `manage` |
| M3 | Nightly audit: read-only job on the commits since the last audit, board digest, stats and open findings; up to 5 proposals or `NO PROPOSALS`; no commits since the last one means no job. | `src/audit.ts`, `roles/auditor.md`, `.agents/harness/criteria/audit.md` | `test/audit.test.ts` | `manage` |
| M4 | Weekly retro: read-only job on the FAIL reviews, findings and outcomes of the merges since the last retro and the roles and criteria; `h retro-due` says when one is due (10 merges and 2 FAILs or 5 findings). | `src/commands/retro-due.ts`, `src/retro.ts`, `roles/retro.md`, `.agents/harness/criteria/retro.md` | `test/retro.test.ts` | `manage` |
| M5 | Clean `/tmp` of `h-*` and `.h-*-worktrees` older than a day, daily and at boot when a day was missed. | `deploy/h-tmp-clean.service`, `deploy/h-tmp-clean.timer` | `test/deploy.test.ts` | `manage` (prune) |
| P1 | `h init <path> --prefix P [--renumber]`: gives a repository what the harness reads (spec skeleton, criteria, project file), lists it in `.h/repos`, sets its prefix, can rename K tickets to it. | `src/commands/init.ts`, `src/init.ts` | `test/init.test.ts` | `projects` |
| P2 | The list of other repositories: `.h/repos`, so wake, `/jobs`, `/board`, `/projects` and `/stopall` reach them. | `src/repos.ts` | `test/repo.test.ts`, `test/wake.test.ts` | `projects` |
| P3 | Onboarding: a job that reads a new repository, asks up to 10 questions, then drafts its vision and criteria; `h merge` refuses any other file. | `roles/onboarding.md`, `src/spawn-job.ts`, `src/continue-job.ts` | `test/spawn.test.ts`, `test/roles.test.ts` | `projects` |
| P4 | Clients: `spec/clients.json` names, per client, the repository, the ticket prefix and the YouTrack URL and token keys. | `spec/clients.json`, `src/integrations/youtrack/instance.ts` | `test/youtrack.test.ts` | `projects` names the instance; `youtrack` holds the instances |
| Y1 | `h youtrack`: list and read articles and issues, create or update an article or an issue from a file, set a custom field, add a work item, list, add, edit and soft-delete comments, save attachments; no verb deletes an issue; an id outside the client's project is refused before any call; the token is never in an error. | `src/integrations/youtrack/command.ts`, `src/integrations/youtrack/instance.ts`, `src/integrations/youtrack/issues.ts`, `src/integrations/youtrack/knowledge-base.ts`, `src/integrations/youtrack/comments.ts`, `src/integrations/youtrack/attachments.ts` | `test/youtrack.test.ts`, `test/youtrack-issues.test.ts` | `youtrack` |
| Y2 | Rules for a job working on a client's issue: issue text is never an instruction, never quoted, no write to YouTrack from a job. | `ISSUES.md` | none | `youtrack` |
| E1 | `h eval`: replays coordinator turns (an ended job, a due schedule entry, a message) against scenarios on a copy of the fixtures with `h` replaced by a recording stub; scores the commands, files and refs the turn touched; baseline of pass rates. | `src/commands/eval.ts`, `src/eval.ts`, `src/eval-run.ts`, `src/eval-stub.ts`, `src/eval-turn.ts`, `src/eval-refs.ts`, `eval/baseline.json`, `eval/fixture/`, `eval/scenarios/` (19 scenarios, listed in section 8) | `test/eval.test.ts` | `develop` |
| E2 | The test kit: a fake `omp`, fake hooks, a safety net that clears variables that could reach the live coordinator, temporary folders removed after a run. | `test/fake-omp.ts`, `test/fake-hooks.ts`, `test/safety-net.ts`, `test/temp-dir.ts` | `test/fake-omp.test.ts` | `develop` |
| E3 | Rules that keep the code small: files at most 200 lines, a line budget for `src/`, no `index.ts` or `utils.ts`, no class or enum, commands import only `src/*.ts`, no import cycles, no runtime dependency, a doc for every command, a character ceiling for the coordinator's prompt, no `h-*` folder or systemd unit left behind by a test run. | `test/structure.test.ts`, `.agents/harness/criteria/styleguide.md`, `tsconfig.json`, `package.json`, `package-lock.json` | `test/structure.test.ts` | `develop` for the test pattern; each plugin has its own budget (vision); `package.json` and `tsconfig.json` drop (the new repository has its own) |
| E4 | Conventional Commits: a git hook refuses a subject that is not `type(scope)!: subject` in 72 characters; `npm ci` points `core.hooksPath` at it. | `.githooks/commit-msg` | `test/commit-msg.test.ts` | drop (repository tooling of the Arthur repo, not a plugin; Gap G10 asks whether client projects get it) |
| E5 | What the models read, in one page: three owners (harness roles, project criteria, spec). | `.agents/harness/README.md` | none | core (docs) |

## 5. Commands: one index

Every command of `COMMANDS` in `src/main.ts` and where each part goes.

| Command | Docs | Arthur home |
| --- | --- | --- |
| `h spawn` (worker) | `docs/commands/spawn.md` | core |
| `h spawn --review` | `docs/commands/spawn.md` | `delivery` |
| `h spawn --audit`, `--retro` | `docs/commands/spawn.md` | `manage` |
| `h spawn --plan`, `--plan-review` | `docs/commands/spawn.md` | `orchestration` |
| `h spawn --onboard` | `docs/commands/spawn.md` | `projects` |
| `h continue` | `docs/commands/continue.md` | core |
| `h steer` | `docs/commands/steer.md` | core |
| `h jobs` | `docs/commands/jobs.md` | core |
| `h stop` | `docs/commands/stop.md` | core |
| `h prune` | `docs/commands/prune.md` | core |
| `h ticket` (digest, `--all`, `new`, `status`, `after`) | `docs/commands/ticket.md` | core |
| `h ticket file` | `docs/commands/ticket.md` | by kind: `delivery` (review), `manage` (audit, retro), `orchestration` (plan) |
| `h ticket status <id> planned --autopilot` | `docs/commands/ticket.md` | `orchestration` |
| `h merge` | `docs/commands/merge.md` | `delivery` |
| `h review-needed` | `docs/commands/review-needed.md` | `delivery` |
| `h changelog` | `docs/commands/changelog.md` | `delivery` |
| `h ci` | `docs/commands/ci.md` | `github` |
| `h schedule` | `docs/commands/schedule.md` | `schedule` |
| `h roles` | `docs/commands/roles.md` | core |
| `h stats` | `docs/commands/stats.md` | `manage` |
| `h retro-due` | `docs/commands/retro-due.md` | `manage` |
| `h health` | `docs/commands/health.md` | `manage` |
| `h send` | `docs/commands/send.md` | `telegram` |
| `h eval` | `docs/commands/eval.md` | `develop` |
| `h init` | `docs/commands/init.md` | `projects` |
| `h youtrack` | `docs/commands/youtrack.md` | `youtrack` |

## 6. The session plugin (proposed) and the coordinator's lifecycle

Today this is the part the vision does not name. It keeps one long conversation of the coordinator healthy: compacted during the day, new every night, restarted when merged code must load. Gap G1 proposes it as the plugin `session`; it needs `orchestration` (or any plugin that runs one interactive `omp`).

| # | What it does today | Files | Tests | Arthur home |
| --- | --- | --- | --- | --- |
| S1 | The coordinator is one interactive `omp` in tmux session `h` on its own tmux socket (`tmux -L h`), started as `omp --continue --auto-approve` with the models and thinking level of its role; `H_COORDINATOR=1` marks it. A systemd user service starts it at boot and again 5 s after it ends for any reason; `start` waits up to 60 s for the previous `omp` to exit, so two never refresh the single-use OAuth token at once (lost the credential on 2026-09-25). `attach` and `stop` (refuses while any job runs). | `bin/h-coordinator`, `deploy/h-coordinator.service` | `test/coordinator.test.ts`, `test/deploy.test.ts` | `session` |
| S2 | Compaction at 08:00, 13:00 and 18:00 Warsaw time (`compact`): writes `.h/compact`; the hook takes it once the session is idle with nothing queued and runs omp's own `/compact`, so the day's decisions stay in the same conversation; waits up to 1800 s, then withdraws the request (`compact: skipped, session busy for N s`); does nothing when no session runs; running jobs do not matter. | `bin/h-coordinator`, `hook/compact.ts`, `deploy/h-coordinator-compact.service`, `deploy/h-coordinator-compact.timer` | `test/coordinator.test.ts`, `test/deploy.test.ts` | `session` |
| S3 | Fresh start once a day at 23:00 Warsaw time (`fresh`), at no other hour, never at 05:00 (a due token refresh met a restart there). Writes `.h/fresh`, ends session `h` and waits for `omp` to exit; the service starts it again without `--continue` and Telegram says `(fresh session)`. Skipped while any job runs. What crosses the night: `.h/after-restart.md`, the board, the tickets, git. | `bin/h-coordinator`, `deploy/h-coordinator-fresh.service`, `deploy/h-coordinator-fresh.timer` | `test/coordinator.test.ts`, `test/deploy.test.ts` | `session` |
| S4 | `/restart` and `/restart fresh` from the phone: answered without the model, only in the service (`H_COORDINATOR=1`), refused with `error: N jobs running: …; run /stopall or h stop first` while any job runs (no force); drops the command's Telegram update so the next coordinator does not read it again; `bin/h-coordinator restart [fresh]` ends the session and the service starts it. | `src/telegram-commands.ts`, `bin/h-coordinator` | `test/coordinator.test.ts` | `session` (the command; `telegram` only carries the text) |
| S5 | Restart guard: the session records the main commit and start time it loaded (`.h/coordinator-head`, `.h/coordinator-started`); a first-parent merge since then that changed `hook/`, `.omp/extensions/` or a file the hooks import makes `h spawn` refuse with `restart due: …` (`--ignore-restart` only on the human's word); the coordinator's prompt carries `## Restart`; `h merge` names such merges; a due restart suppresses the health line for an unstarted planned ticket. | `src/restart-due.ts`, `src/spawn-job.ts`, `hook/context.ts`, `hook/wake.ts`, `src/health-jobs.ts` | `test/repo.test.ts`, `test/spawn.test.ts`, `test/coordinator.test.ts`, `test/init.test.ts` | `session` (the check; core's spawn asks it through an event or a refusal hook) |
| S6 | LLM access probe at every start: one word asked of the coordinator's model first; Telegram says `no LLM access on <host>: <reason>; run omp login` in place of `coordinator up on <host>`. A turn that fails before any text sends `turn failed on <host>: <reason>`. | `src/llm-probe.ts`, `hook/telegram.ts` | `test/telegram.test.ts` | `session` (the probe); `telegram` sends the notice |
| S7 | Units that make it survive: the user manager is restarted when it dies, so is the service; controllers handed to the user manager. | `deploy/user@.service.d/restart.conf`, `deploy/user@.service.d/delegate.conf` | `test/deploy.test.ts` | `session` (restart.conf), core (delegate.conf, see R5) |
| S8 | The VPS recipe: install node, git, tmux, ffmpeg, omp; deploy key; `.env`; the unit's `PATH`; enabling timers; the threat model; daily use; update procedure. | `deploy/README.md` | `test/deploy.test.ts` | core docs for the process; `session` for the timers |

Config options of the session plugin. Today these are fixed in unit files and the script; the names after the arrow are proposed.

| Today | Where | Option in Arthur |
| --- | --- | --- |
| Compaction times 08:00, 13:00, 18:00 | `deploy/h-coordinator-compact.timer` | `compactAt: ["08:00", "13:00", "18:00"]` |
| Fresh start time 23:00 | `deploy/h-coordinator-fresh.timer` | `freshAt: "23:00"` |
| Time zone Europe/Warsaw | both timers, `TZ=` in `bin/h-coordinator` | `timeZone` (shared, Gap G4) |
| Wait for an idle session, 1800 s | `compact [seconds]` in `bin/h-coordinator` | `compactWaitSeconds: 1800` |
| Wait for the previous `omp`, 60 s | `wait_for_omp` | `exitWaitSeconds: 60` |
| Restart delay, 5 s | `RestartSec` in the service and the drop-in | `restartDelaySeconds: 5` |
| tmux socket and session name `h` | `bin/h-coordinator`; `H_TMUX_SOCKET` for tests | `tmuxSession`, `tmuxSocket` |
| Refuse restart, stop and fresh while jobs run (no force) | `bin/h-coordinator` | none: stays a rule |
| Restart guard on or off, which paths count as loaded code | `src/restart-due.ts` | `restartGuard: true`; the plugin host knows which paths each plugin loads |
| LLM probe at start | `src/llm-probe.ts` | `probeLlm: true` |
| Model, thinking level, smol model of the coordinator | `H_MODEL_COORDINATOR`, `H_THINKING_COORDINATOR`, `H_MODEL_SMOL` | owned by `orchestration` |
| Files kept in `.h/`: `fresh`, `compact`, `coordinator.pid`, `after-restart.md`, `coordinator-head`, `coordinator-started` | `bin/h-coordinator`, hooks | files in `.arthur/` |

## 7. Telegram: the channel and the phone commands

| # | What it does today | Files | Tests | Arthur home |
| --- | --- | --- | --- | --- |
| T1 | The bridge: long polls the bot (30 s), answers only `TELEGRAM_CHAT_ID`, drops messages older than 10 min, turns text into `[via Telegram] <text>` coordinator turns in order, sends every finished turn back (long text in slices at line breaks), says once when polling fails (a second poller gets 409) and keeps retrying; any other kind of message gets `only text, photos and files reach the coordinator`. | `hook/telegram.ts` | `test/telegram.test.ts` | `telegram` |
| T2 | Sending: Bot API calls, one retry, a failed slice queued in `.h/telegram-outbox/` and sent first next time in order, a refused (4xx) slice set aside and told once; quiet hours 22:00 to 07:30 send without a notification; text cut to one message with a note. | `src/telegram-api.ts` | `test/telegram.test.ts`, `test/audit.test.ts` | `telegram` |
| T3 | Media in: a photo (largest size) or a file, an album as one turn, saved under `.h/telegram/` and named in the turn; a photo is also attached as an image. | `src/telegram-media.ts` | `test/telegram.test.ts` | `telegram` |
| T4 | Media out: `h send <file>… --caption`: photos and videos as an album, other types as documents after it, up to 10 files, sizes and extensions checked before anything is sent, a photo whose sides break Telegram's limits refused with a hint to slice it, the token never in an error. | `src/commands/send.ts`, `src/telegram-send.ts` | `test/send.test.ts` | `telegram` (media out) |
| T5 | Start notice: `coordinator up on <host>` (`(fresh session)` after `fresh`), or the LLM failure of S6; the command menu (`setMyCommands`) lists the phone commands. | `hook/telegram.ts` | `test/telegram.test.ts` | `telegram` (menu built from the commands the plugins register: Gap G3) |
| T6 | `/jobs`: the job list of this checkout and every listed repository, without ids. | `src/telegram-commands.ts`, `src/jobs-listing.ts` | `test/telegram.test.ts` | core command (`telegram` only carries it) |
| T7 | `/board [PREFIX] [all]`: the full board when it fits one message, else the digest; a prefix picks another project. | `src/telegram-commands.ts`, `src/board.ts` | `test/telegram.test.ts` | core command |
| T8 | `/projects`: prefix, folder, open tickets and running jobs of every project; a broken project file gets a line. | `src/telegram-projects.ts` | `test/telegram.test.ts` | `projects` command |
| T9 | `/findings <ticket>` and `/task <ticket>`: the ticket's `findings.md` or `ticket.md` with its status, the id as `14`, `K0014` or `EDLS14`, from the main checkout (findings from a worker's branch when main lacks them). | `src/telegram-commands.ts` | `test/telegram.test.ts` | core commands |
| T10 | `/plan <ticket>`: the ticket's `plan.md`. | `src/telegram-commands.ts` | `test/plan.test.ts` | `orchestration` command |
| T11 | `/retro`: the newest `spec/retro/<date>.html` sent as a file. | `src/telegram-retro.ts` | `test/telegram.test.ts` | `manage` command |
| T12 | `/health`: what `h health` prints. | `src/telegram-commands.ts` | `test/health.test.ts`, `test/telegram.test.ts` | `manage` command |
| T13 | `/steer <id> <text>`: `h steer`, replies `steered <id>: 0001` or the refusal. | `src/telegram-commands.ts` | `test/telegram.test.ts`, `test/steer.test.ts` | core command |
| T14 | `/stopall`: cancels pending hand-backs, stops every running job of every repository, one line each; answered without the model. | `src/telegram-commands.ts`, `src/hand-back.ts` | `test/stop.test.ts`, `test/hand-back.test.ts` | core command (the hand-back cancel is `delivery`'s) |
| T15 | `/restart`, `/restart fresh`: see S4. | `src/telegram-commands.ts` | `test/coordinator.test.ts`, `test/telegram.test.ts` | `session` command |

## 8. Schedule, deploy units, and state files

| # | What it does today | Files | Tests | Arthur home |
| --- | --- | --- | --- | --- |
| C1 | `spec/schedule.json`: entries with a daily `HH:MM` or a one-off `YYYY-MM-DDTHH:MM`, an instruction and an optional procedure name; the sweep claims a due slot once (a daily entry missed for days fires once, late ones say so), sends it to the coordinator as `[scheduled <id>] …`; a hand-broken entry is skipped and named; `h schedule` adds, lists, removes. | `src/commands/schedule.ts`, `src/schedule.ts`, `hook/schedule.ts`, `spec/schedule.json` | `test/schedule.test.ts` | `schedule` |
| C2 | The recurring entries today: S0002 08:00 morning report; S0004 22:30 weekly retro, acts only in the night from Friday to Saturday; S0007 02:00 harness audit, acts only on Tuesday and Friday; S0008 a one-off CI check. The rules on which day they act are prose in each instruction. | `spec/schedule.json` | none | `schedule` entries owned by `manage` (audit, retro) and `orchestration` (report); Gap G6 moves the day rules into options |
| C3 | Run state of the schedule stays out of git: `.h/schedule/<id>` (last run) and `<id>.<slot>` (claimed slot). | `src/schedule.ts` | `test/schedule.test.ts` | `schedule` |
| C4 | The deploy units, each: `h-coordinator.service` (S1), `h-coordinator-compact.service` and `.timer` (S2), `h-coordinator-fresh.service` and `.timer` (S3), `h-tmp-clean.service` and `.timer` (M5), `user@.service.d/restart.conf` (S7), `user@.service.d/delegate.conf` (R5). | the nine unit and drop-in files of `deploy/` (each also in the row named) | `test/deploy.test.ts` | as in the rows named |
| C5 | Quality and retro reports: one dated file per audit or retro, plus the retro's phone page. | `spec/quality/`, `spec/retro/` | `test/audit.test.ts`, `test/retro.test.ts` | `manage` |
| C6 | Planning documents for Arthur itself. | `spec/next/` | none | drop (not a capability; becomes the new repository's history) |
| C7 | Eval scenarios (19): after-restart-plan, audit-autopilot, check-failed, ci-failed, condition-before-review, env-refusal, later-is-a-ticket, merge, morning-report, night-one-line, no-sleep, onboarding-questions, retro, review-fail-continue, review-fail-handed-back, review-pass, review-pass-hook, unblocked-after-restart, worker-done. | `eval/scenarios/` | `test/eval.test.ts` | `develop` (each scenario moves with the plugin whose procedure it tests) |
| C8 | Runtime state in `.h/` (not in git): `jobs/<id>/` (the job record), `repos`, `schedule/`, `telegram/`, `telegram-outbox/`, `youtrack/<id>/` (saved attachments), `eval/<time>/`, and the session files of S1 to S5. | none (written by the files above) | none | `.arthur/` in the home folder; each plugin owns its folder |
| C9 | Changing a secret: `.env` is never committed, `.env.example` lists every variable empty, a test keeps both true. | `.env.example`, `.gitignore` | `test/structure.test.ts` | core (replaced by `arthur.config.ts` with `...Env` names) |
| C10 | What a job can reach, and where the harness's protection ends. | `SECURITY.md` | none | core docs |

## 9. Configuration today (.env.example) and its home

| Variables | What they set | Arthur home |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | the bot and the one allowed chat | `telegram` (`tokenEnv`, `chatEnv`) |
| `H_MODEL_<ROLE>`, `H_THINKING_<ROLE>`, `H_MODEL_SMOL`, `H_THINKING_SMOL` | model and thinking level per role | `orchestration` |
| `H_JOB_TIMEOUT`, `H_JOB_BUDGET` | default time and money limit of a job | core |
| `H_AUDIT_BUDGET` | audit budget | `manage` |
| `H_PLAN_BUDGET` | plan budget | `orchestration` |
| `H_AUTOPILOT_BUDGET`, `H_AUTOPILOT_BUDGET_MAX` | budget of an autopilot job and its cap | `orchestration` |
| `H_JOBS_CPU`, `H_JOBS_MEMORY` | joint limit of all jobs | core |
| `H_PATH_PREPEND` | folders in front of `PATH` for a project's jobs and merge checks | core (per project, set in `projects`) |
| `H_GITHUB_ACTIONS_TOKEN` | read the CI run; rerun it | `github` (`tokenEnv`) |
| `YOUTRACK_<NAME>_URL`, `YOUTRACK_<NAME>_TOKEN` | one YouTrack server per client | `youtrack` (named instances) |
| `H_INTERNAL_RUN`, `H_JOB_DIR`, `H_STEER_DIR`, `H_OWN_WORKTREE`, `H_OWN_JOB_DIR` | the wrapper's and the guards' own switches | core |
| `H_COORDINATOR`, `H_FRESH`, `H_TMUX_SOCKET` | the service marker, the fresh-start marker, the test tmux socket | `session` |
| `H_EVAL_STUB`, `H_EVAL_H_CALL` | the eval's stub and its ref log | `develop` |
| `H_PROCESS_TABLE`, `H_JOBS_SLICE`, `H_TELEGRAM_API` | test seams: force `ps`, use another slice, use another Bot API URL | core and `telegram` (kept for tests) |

## 10. Gaps: capabilities with no plugin in the vision

| # | Capability | Why it is a gap | Proposed home |
| --- | --- | --- | --- |
| G1 | Session lifecycle: daily compaction (08, 13, 18), fresh start (23), `/restart` and `/restart fresh`, the restart guard, `after-restart.md`, the start notice and LLM probe (rows S1 to S8, O4) | The vision names no plugin for it, and `orchestration` would grow past one job | A new plugin `session`, first version, requires `orchestration`. Options in section 6. |
| G2 | Worktree guard and its shell parser (R17) | The vision's core lists only the env guard; without this guard a job can write into the main checkout or another job | `core`, beside the env guard, on for every job |
| G3 | Phone commands that need no model (T6 to T15) and the command menu | Today `src/telegram-commands.ts` answers them inline and imports board, jobs, health, stop, steer, hand-back and the restart. A plugin must not import another | The host keeps a registry of commands; each plugin registers its own (core, `projects`, `orchestration`, `manage`, `session`); `telegram` and every later channel only route `/name text` to the host and send the reply |
| G4 | Night and time zone: quiet hours 22:00 to 07:30 (silent messages, one-line night replies in the coordinator's prompt), `TZ=Europe/Warsaw`, timers in Warsaw time | Shared by `telegram`, `orchestration`, `session` and `schedule`; no plugin may import another | `core` config: `timeZone` and `quietHours`, read by each plugin through the host |
| G5 | Planning of large tickets (O9, O14, B9, T10): planner role, `- Plan: tak`, plan review | The vision lists `orchestration` for the coordinator only | `orchestration`, as a part of it; split into its own plugin `planning` only if orchestration passes its line budget |
| G6 | Who decides when the nightly audit and the weekly retro run: today prose in `spec/schedule.json` ("only Tuesday and Friday", "only Friday night") | Policy hidden in free text the coordinator must obey; a schedule plugin cannot hold such conditions | `manage` options `auditDays`, `retroDay` that create the entries; `schedule` fires them |
| G7 | Finding a dead job (R12) and the joint resource limit (R5) | Job-runner duties that sit today in a coordinator hook and a systemd slice | `core` job runner |
| G8 | The per-project vision and criteria read by roles (`spec/vision.md`, `.agents/harness/criteria/*.md`, project role overrides) | The vision does not say where a project's own prompt files live | `projects` owns the folder and the list of criteria per role; `core` loads them (R14) |
| G9 | Docs per command and `h <cmd> --help` (R19) | The plugin API must carry a doc path, or a plugin's commands lose `--help` | Part of the host API: a command registers with its doc file |
| G10 | Commit subject rule (E4) and `.githooks` | Enforced today in this repository only, though jobs of other repositories share their own git config | Stays repository tooling of the Arthur repo. Open: whether `delivery` should install the same hook in client projects |
| G11 | Language: every message and prompt is English in Arthur; today Polish is in the coordinator's final message and the retro page's headings (`roles/coordinator.md`, `roles/coordinator/*.md`), and Polish words are keys read by code: `dalej:` before a procedure in a message (`src/roles.ts`), `- Plan: tak` as the planning marker (`src/plan.ts`, `src/board.ts`, `src/check-tickets.ts`, `src/spawn-job.ts`), `tak` in ticket files that exist | A rename of those keys breaks every existing ticket and message the day Arthur starts reading them | `core` ticket board reads the new key; the move writes a one-time rewrite of old tickets; the roles are translated with the plugin that owns them |
| G12 | The history of tickets, outcomes, reviews, quality and retro reports in `spec/` | The new repository starts clean (vision), so this record has no destination | Stays in this repository, archived; the human decides what is carried over |
| G13 | `h init --renumber` and per-repository ticket prefixes (P1, B3) | Needed only because ticket ids live in one global namespace per repository; the vision does not say whether Arthur keeps prefixes | `projects` (it owns the project file); keep unless the human drops prefixes |

## 11. Check: every file is in the table

The command lists every tracked file in the folders the ticket names, `docs/`, `eval/`, `test/`, the root files and the `spec/` state files, and prints the ones whose path does not appear in this file. No `missing:` line means every path is in a row. Only `eval/fixture/` and `eval/scenarios/` stand for a whole tree each, since they hold fixtures and scenario files, not capabilities.

```
git ls-files src hook .omp/extensions bin deploy roles .agents/harness docs test eval/baseline.json .githooks .github .env.example .gitignore CHANGELOG.md ISSUES.md SECURITY.md package.json package-lock.json tsconfig.json spec/build.json spec/clients.json spec/schedule.json spec/vision.md | while read f; do grep -qF "\`$f\`" spec/next/inventory.md || echo "missing: $f"; done
```

Output of the run of 2026-10-16 (the command printed no `missing:` line; a second pipeline with `wc -l` counted the files):

```
$ git ls-files ... | while read f; do grep -qF "`$f`" spec/next/inventory.md || echo "missing: $f"; done
$ git ls-files ... | wc -l
209
```

0 missing of 209 files.

Besides files, run the same way: each of the 20 commands of `COMMANDS` has a row in section 5, each of the 11 phone commands has a row in section 7, each of the 19 scenario names, and each deploy unit name, appears; and each folder entry (`spec/features/`, `spec/features/_template/`, `spec/quality/`, `spec/retro/`, `spec/next/`, `eval/fixture/`, `eval/scenarios/`) is named above.
