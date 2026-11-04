# AR0604 - Plan

- Job: 2026-11-04-plan-1c9fb07e
- Planned at: 55b85bd0b015a330566a95b45bbf01bbd1c63926

## Approach

Four worker tickets build roadmap entries 70 to 72. They come in the order below and depend on each other:

1. **W1, core (71, core half).** Adds `host.jobs.cleanup(fn)` and makes `host.jobs.prune` return a promise.
   - Every removal already goes through one function, `prune` in `packages/core/src/job-records.ts`: `arthur prune`, the merge and a dropped ticket (both via `packages/delivery/src/ticket-prune.ts`), and manage's daily prune (`packages/manage/src/cleanup.ts`). So "one removal that every path uses" already holds; only the hook is new.
   - Hook contract:
     - **Signature:** `cleanup(fn: (job) => void | string | Promise<void | string>)`. `job` is `{ id, kind, project, task, state, reason, branch, worktree, machine }`; `machine` is `local` when the record names none.
     - **When it runs:** inside `prune`, after every check that keeps everything (not ended, the machine offline, no `root`, a moved place under AR0610, planted Git config). It runs right before `git worktree remove` here, or before `arthur remote-job prune` on the other machine.
     - **How:** hooks run one at a time, in setup order, each limited to 2 minutes. A throw, a rejection or the time limit gives up on that hook and emits one core `notice` naming the job, the machine, the plugin and the reason. The worktree is removed all the same.
     - **Output:** a returned text joins the job's prune line as `<plugin>: <text>`, before Git's parts.
     - **Repeats:** the hook runs again on every later prune of the same job, so a hook must be safe to repeat.
     - `jobs.keep` is unchanged: it is still asked after the worktree and branch go.
2. **W2, docker (70).** The new `packages/docker` plugin:
   - its options (`buildCache`, `leftoverHours`, `sweep.at`) and the piece `docker.project(false)`, the shape `arthur.config.example.ts` already shows;
   - a prepare that, for a job on a machine labelled `tools: docker`, writes a `docker` script for that job into `<home there>/docker/jobs/<id>/`. That script runs Arthur's own `node` on a copy of `docker-label.ts`, which adds `--label arthur.job=<id>` to the commands that create something and then runs the real `docker`. The prepare also returns `PATH` (the folder first, built the way nvm builds its PATH) and `COMPOSE_PROJECT_NAME=arthur-<last 8 hex>`;
   - `provide("resources.disk")` naming Docker's data root;
   - the `doctor` requirements from entry 70.
   - The labels come from a new provided name in machines (Not available directly, item 2).
3. **W3, docker (71, docker half).** The cleanup hook: Docker reachable at all, then the job's containers (stopped with a 10 s grace, removed with their anonymous volumes), its networks, volumes and images. Each refusal is kept and named. Then `docker builder prune --max-used-space`, then the job's script folder. It returns one line per job: what went, what was kept and why, the space freed.
4. **W4, docker (72).** The sweep: daily through `schedule.register`, on `disk-low` for that machine, and by hand with `arthur docker sweep [--machine] [--dry-run]`. Sweeps are serialised per machine with `queueLock` from `@arthur/core/lock`. Also `arthur docker`, and one notice per sweep.

**Left alone:**
- the sandbox (AR0376);
- `jobs.keep`, github, and resources' floor (entry 69, already built);
- `docker.project({ service })`, the "Also delivers" of entry 70: held out of these tickets (item 3 below).

**Does `jobs.keep` already serve as the cleanup hook? No.** The code shows three reasons:
- **It is asked too late, or not at all.** It is asked after the removal, and only when both the worktree and the branch went: `prune` returns early on a kept worktree and on `kept branch … and the record`. So a job whose unmerged branch is kept loses its worktree without `jobs.keep` ever being asked. Its Docker resources stay, and the sweep never takes them, because their job's record still exists.
- **It cannot wait.** It is synchronous: answers are filtered to strings (`job-records.ts:173`), so a promise is dropped. Docker work through it would run detached, as github's origin deletion does: no line in the prune's output, no 2-minute limit, and `arthur prune` could return before the cleanup ends.
- **It cannot move earlier.** github needs it after `git branch -d`: it deletes the branch on origin only once Git found it merged.

A separate hook is smaller than reshaping `jobs.keep`. Either way prune has to become async, because a hook that runs Docker over SSH must be awaited.

**Docker on the owner's machines today: none of the owner's projects runs Docker in a job, on any machine.**
- **Machines:** `arthur.config.ts` has no `machines` plugin, so `local` (the VPS) is the only machine and has no `tools` labels. `core.jobs.unsandboxed` is not set.
- **arthur:** no Docker; its tests fake every outside service.
- **landing.example:** its checkout `/home/kacper/landing.example` has a `Dockerfile`, `.dockerignore` and `docker-start.sh`, used for its deploy image [INFERENCE: built on Dokploy, whose host is 89.117.53.129; this VPS is 217.173.5.23]. Its `package.json`, CI workflows and `AGENTS.md` do not mention Docker.
- **web-shop.example:** only `spec/`, `.agents/` and `.nvmrc`.
- I could not read either project's `project.config.ts`: the sandbox refused it (Permission denied).
- **What Docker is on the VPS:** client 29.9.2, Compose v5.6.1, buildx 0.38.1. There are 11 Docker bridges and three running containers that are not Arthur's: MySQL on 3306, Mailpit on 1025/8025, Postgres on 127.0.0.1:5436 [INFERENCE: dev stacks of the owner's other repositories in `/home/kacper`].
- **Disk:** `/` 125 G, 41 G free, 66% used, the same numbers the vision gives for the harness on 2026-10-16.
- **Why no job can use Docker:** see Not available directly, item 1.

**What that means for the order:**
- Nothing exists to label or to clean per job. The only Docker data on the VPS predates Arthur's jobs and is unlabelled.
- Recommendation: keep W1 to W4 in planning until a project's jobs need Docker on a machine that can give it to them.
- Meanwhile, the protection that already exists is one config line: `resources({ keepFree: { disk: "20G" } })`.
- If the owner keeps the 2026-10-19 decision to build Docker right after the switch, the order is W1 → W2 → W3 → W4.

## Not available directly
- **1. A job cannot reach Docker on Linux.**
  - What I found:
    - The job sandbox's seccomp filter allows only datagram Unix sockets (`packages/core/src/job-sandbox.ts:11-18`), and `spawn.md` line 136 says a check needing Docker fails inside a job.
    - From this job, `docker ps` against a socket that does not exist answers `permission denied while trying to connect to the docker API at unix:///tmp/arthur-plan-nosuch.sock`.
    - `core.jobs.unsandboxed` only applies where the sandbox cannot be set up (`core-options.ts:62`), so a Linux machine with Landlock and python3 has no way to turn it off. Merge checks run sandboxed too.
  - Option 1: keep the sandbox. Labels and per-job cleanup act only where a job runs unsandboxed (macOS, no python3, `unsandboxed: true`); the sweep works everywhere, because Arthur's own process runs it - cost 4 tickets, about 3.5 days; risk: they do nothing on the VPS.
  - Option 2: let a project's jobs reach the Docker socket - cost a core sandbox change, and seccomp sees a socket's type, not its path, so tmux and the systemd bus open too; risk: Docker's socket is root on the machine (`docker run -v /:/host`), so the bound AR0376 sets is gone.
  - Option 3: a proxy outside the sandbox that passes only a job's own labelled, unprivileged requests - cost a new component that parses Docker's API; risk: one gap in its allowlist is root.
  - Recommendation: Option 1
- **2. A plugin cannot read a machine's labels.**
  - What I found: `host.jobs.machines()` returns names only (`host-jobs.ts`). The core gives `local` `labels: {}` (`job-machine.ts`); local's `tools` exist only inside machines (`machines.ts:75`).
  - Option 1: machines provides `machines.labels` (name → labels) - cost about 3 lines, one new provided name; risk: docker does nothing without the machines plugin, which the owner's config does not load.
  - Option 2: the core gives `host.jobs.labels(machine)` - cost: local's labels first have to be moved into the core; risk: a wider API change.
  - Option 3: docker ignores labels and acts wherever `command -v docker` finds Docker - cost: less code; risk: drops the owner's opt-in that the vision describes.
  - Recommendation: Option 1
- **3. `docker.project({ service })` (entry 70, "Also delivers").** The install runs in the job's sandbox and `arthur merge` runs its checks in a sandbox of its own (`docs/deploy.md:41`), so neither reaches Docker.
  - Option 1: hold it out of these tickets until a project lives in Docker - cost none; risk: entry 70 is not complete.
  - Option 2: build it as a fifth ticket, for unsandboxed machines only - cost about half a day, touching projects (`ARTHUR_INSTALL`) and delivery (merge checks); risk: code that runs nowhere today.
  - Recommendation: Option 1

## Files
- **W1 (core hook):**
  - `packages/core/src/job-cleanup.ts` (new, about 35 lines): the list of hooks with their owners, the per-hook time limit (a parameter, 120 s by default), the notice, the returned texts.
  - `packages/core/src/job-records.ts`: `prune` becomes async and calls the hooks at the point described in Approach; `jobUpkeep.prune` runs the jobs one after another.
  - `packages/core/src/jobs.ts`: `cleanup(owner, fn)` on the runner, passed to `jobUpkeep`.
  - `packages/core/src/host-jobs.ts`: `cleanup(fn)`; `prune` returns `Promise<string[]>`.
  - `packages/core/src/plugin-host.ts`: the `cleanup` member.
  - `packages/core/src/job-commands.ts`: `await` in the `prune` command.
  - `packages/delivery/src/ticket-prune.ts`: `pruneTicket` becomes async.
  - `packages/delivery/src/delivery.ts`: `dropped` returns the promise; the `ticket-moved` handler returns it; the `setImmediate` path catches the rejection and logs it.
  - `packages/delivery/src/merge-command.ts`: `await` on the same line, so no new line.
  - `packages/manage/src/cleanup.ts`: `part` awaits `run`.
  - Docs: `packages/core/docs/commands/prune.md` (the hooks); `docs/plugin-api.md` (host table row `jobs.cleanup`, `jobs.prune` now a promise, an entry under "Changes since entry 51").
  - Tests: `await` or `assert.rejects` on 40 calls in `packages/core/test/job-records.test.ts`, `job-control.test.ts`, `machine.test.ts` and `packages/github/test/github-branch.test.ts`. One new test in `job-records.test.ts` covers order, text, throw, time limit, kept-before-removal and a second prune.
  - `test/structure.test.ts`: BUDGETS.
  - `CHANGELOG.md`.
- **W2 (docker, 70):**
  - Package: `packages/docker/package.json` (exports `.` and `./options`).
  - Source:
    - `src/docker.ts`: plugin, setup, `docker.project`.
    - `src/docker-options.ts`: table, `tools` with docker's version command, checks, piece check.
    - `src/docker-label.ts`: the argument rewrite; imports only `node:`; run as `node <copy> <real docker> <id> …`.
    - `src/docker-prepare.ts`: label and piece checks, finding `docker` and `node` on the machine, writing the script with `host.jobs.run` and its input, the "no docker on this machine" line said once per machine.
    - `src/docker-doctor.ts`.
  - Docs: `docs/docker.md`.
  - Tests:
    - `test/fake-docker.ts`, `test/docker-shapes.json`, `test/fake-shapes.test.ts`: the fake `docker` on `PATH`, described next.
    - `test/labels.test.ts` and `test/docker-options.test.ts`.
  - The fake `docker` (in `test/fake-docker.ts`):
    - a node script that appends each argument list to `calls`;
    - keeps containers, networks, volumes, images and build cache in a `state.json` with Docker's fields;
    - answers `--format '{{json .}}'` with the keys `docker ps`, `network ls`, `volume ls`, `volume inspect`, `image ls` and `system df` print;
    - answers `info --format` and `builder prune` (`Total:`);
    - when a `down` file exists, every daemon command fails with Docker's daemon error and exit 1.
    - Keys and error texts are recorded from docker/cli v29 source in `docker-shapes.json`, with `sources` and `recorded` as in `dokploy-shapes.json`. A fake `ssh` runs commands locally, as in `resources/test/disk.test.ts`.
  - machines: `packages/machines/src/machines.ts` provides `machines.labels`; a test for it in `machines.test.ts`; `docs/machines.md`.
  - Root:
    - `test/option-tables.test.ts`: the docker entry.
    - `test/structure.test.ts`: the first docker budget, and machines' raise.
    - `package-lock.json`: the new workspace.
    - `arthur.config.example.ts`: drop "planned" for docker; `docker.project(false)`.
    - `README.md` lines 55 and 70, and `arthur.mmd`.
    - `docs/setup.md:115`.
    - `docs/plugin-api.md`: `resources.disk` provided by docker; a `machines.labels` row.
    - `CHANGELOG.md`.
- **W3 (docker, 71):**
  - `packages/docker/src/docker-cleanup.ts` (new): the hook.
  - `src/docker.ts`: `host.jobs.cleanup(...)`.
  - `test/fake-docker.ts`: removals and Docker's refusals (a volume in use, an image a container uses, a network with endpoints).
  - `test/cleanup.test.ts`: real Git through `fake.host.jobs.spawn`, then `await fake.host.jobs.prune`.
  - `docs/docker.md`, `CHANGELOG.md`, BUDGETS.
- **W4 (docker, 72):**
  - `packages/docker/src/docker-sweep.ts` (new): what to remove by label, by job record, by age and by `arthur.keep`; dry run; free disk after (`df -Pk` on the data root); still under the floor (from the last `disk-low` seen for that machine); the notice; the sweep also removes script folders of jobs that no longer exist.
  - `src/docker-command.ts` (new): `arthur docker` and `arthur docker sweep`.
  - `src/docker.ts`: the schedule entry, refused at load without schedule as manage does; the `disk-low` handler; the commands.
  - Docs: `docs/commands/docker.md` and `docs/commands/docker-sweep.md`.
  - Tests: `test/sweep.test.ts`, with the fake's resources at known ages; the fake's `now` comes from the state file.
  - `CHANGELOG.md`, BUDGETS.
- **Line budgets** (counted as `test/structure.ts` counts; core 7153, delivery 2064, manage 1340, machines 535 sit exactly at their budgets today):

| Package | Today | After | Ticket |
|---|---|---|---|
| core | 7153 | about 7205 | W1 |
| delivery | 2064 | about 2067 | W1 |
| manage | 1340 | about 1342 | W1 |
| machines | 535 | about 538 | W2 |
| docker (new) | — | about 340 | W2 |
| docker | about 340 | about 460 | W3 |
| docker | about 460 | about 690 | W4 |

  - Unchanged: core/testing 403 (`fakeHost` spreads `real.jobs`), github 1020 (only its tests change), resources 638 and schedule 619.
  - Each raise shows in its merge's outcome.md. Every touched file stays green: `job-records.ts` goes from 188 to about 194 counted lines, `jobs.ts` from 192 to about 194.

## Risks
- **The daemon could crash if the drop's prune rejects.** Today a throw inside the `setImmediate` call in `delivery.ts:83` happens synchronously. Async, an uncaught rejection would end `arthur run`. W1 adds a catch there, and the `ticket-moved` handler returns the promise, which `events.ts` `deliver` already catches.
- **A worktree Git keeps after the hook ran loses its Docker resources.** This happens when Git finds changes during `git worktree remove`. The vision puts the cleanup before the removal; the resources can be rebuilt. Open question 5 offers the other order.
- **The script folder may be unreadable in a sandboxed job.** The home is hidden from a sandboxed job (`job-sandbox.ts:99-101`), so a `docker` script first on its `PATH` may give "Permission denied" even for commands that need no daemon [INFERENCE: whether exec of a hidden file falls through to the next PATH entry]. W2 tests it. If it does not fall through, the script folder must be readable by the job.
- **The copied `docker-label.ts` must run on a Node that strips types.** The project's `.nvmrc` may name an old Node, so W2 runs Arthur's own `node`, by the absolute path found outside the job's `PATH`.
- **Labels must stay correct.** If two `--label arthur.job=` reach Docker, which one wins is unknown [INFERENCE], so the rewrite removes every `arthur.job` label the job passes and adds its own. Arguments after the image stay untouched; that needs the list of `run`/`create` flags that take no value. Unit tests cover each edge case entry 70 names.
- **Docker texts change between versions.** The plugin decides from exit codes and JSON lines, never from error strings. A `docker info` probe tells "not running" apart from a refusal.
- **The sweep could take the owner's own data.** The VPS runs MySQL, Mailpit and Postgres stacks that are not Arthur's. If he stops one, the vision's sweep removes its stopped containers and unused anonymous volumes after `leftoverHours`; the MySQL image declares a volume [INFERENCE: its data may sit in an anonymous one]. Open question 4. W4's docs say to run `--dry-run` first and to label with `arthur.keep`.
- **Images built by a compose stack might not be removed.** That compose labels the images it builds with `com.docker.compose.project` is [INFERENCE]. W3 tests it against recorded shapes; an image without the label is kept and named in the job's line.
- **A notice whenever Docker is down.** A prune while Docker is not running gives one notice per job.

## How to test
- **The files of each worker ticket:** Files, W1 to W4.
- **The core hook's contract:** Approach, item 1. In W1, `job-records.test.ts`:
  - a hook sees the job before its worktree goes, and its text is in the line;
  - a throwing hook and one past the limit (the limit set to 50 ms in that test; the test waits for the notice) both give a notice, and the worktree is gone;
  - a job kept for not having ended, or for planted config, calls no hook;
  - a second prune calls the hook again;
  - a job on another machine through `machine.test.ts`.
  - Then `npm run check` and `npm test`.
- **`jobs.keep` versus a separate hook:** Approach, "Does `jobs.keep` already serve as the cleanup hook?", with lines in `job-records.ts` and `github.md:70`.
- **A fake `docker` in the shape of Docker's CLI output:** Files, W2. `fake-shapes.test.ts` holds the fake to `docker-shapes.json`, as dokploy's does.
- **Each package's line budget:** Files, the budgets table. Each ticket's `test/structure.test.ts` run proves it; I ran it here: 20 pass, counts as in the table.
- **The questions for the owner:** Open questions.
- **Which projects run Docker on which machines today:** Approach, "Docker on the owner's machines today". Evidence from this run:
  - the owner's `arthur.config.ts`: no machines plugin, no `unsandboxed`;
  - `find` of Docker files in the three checkouts; `grep` of `package.json`, workflows and `AGENTS.md`;
  - `docker version` (client 29.9.2), and the refused `docker ps` with a fake `DOCKER_HOST`;
  - `ip -o link` (3 veth) and `ps` (containerd-shim and docker-proxy for 3306, 1025/8025, 5436);
  - `df -h /`.
- **The worker tickets' own Done means:** each ticket's tests against the fake host and the fake `docker`, plus one smoke run of `arthur docker sweep --dry-run` on a machine with Docker, outside a job: a job cannot reach the daemon.

## Open questions
- **Order.** No project runs Docker in a job, and no Linux job can reach Docker. Keep W1 to W4 in planning until one needs it, setting `keepFree.disk` (for example "20G") in resources meanwhile? Or build W1 → W4 now, as decided on 2026-10-19? Recommend keeping them in planning.
- **Sandbox.** Approve Not available directly 1, Option 1: Docker only for jobs on machines where the sandbox cannot be set up, the sandbox unchanged?
- **Scope.** Approve leaving `docker.project({ service })` out of these tickets (Not available directly 3), which reduces entry 70?
- **The sweep on a shared machine.** Should unlabelled stopped containers and anonymous volumes go after `leftoverHours`, as the vision says? Or should the unlabelled part be limited to dangling images, unused networks and the build cache, so the owner's own stopped stacks keep their containers and data? Recommend the limit.
- **When the cleanup runs.** Before the worktree removal (the vision), or only once Git has removed it? After would spare a worktree Git keeps for its changes, and an offline machine would give no notice.
- **Docker's first line budget.** About 340 after W2, rising to about 690 by W4; a new package's first budget is the owner's to set.
- **API changes, each to be recorded in its ticket's Decisions** (`docs/plugin-api.md`, first paragraph): `host.jobs.cleanup(fn)`; `host.jobs.prune` returning a promise; the provided name `machines.labels`. Approve all three?