# AR0483 - Plan

- Job: 2026-11-08-plan-b43d22c1
- Planned at: 8ea3a84df617387295927c7569da1f4399ea28e4

## Approach
This ticket needs one deliverable: this plan, filed as `plan.md` by `arthur ticket file AR0483 <plan job>`. No code changes. Whichever option the owner picks gets built in follow-up tickets (Scope: Out). The worker after approval changes no file. It only confirms that the checks still pass.

Facts the options depend on (read in this checkout):
- **How the coordinator starts.** `supervise` in `packages/orchestration/src/coordinator.ts` starts `omp --auto-approve` with every tool and loads only `-e env-guard`, the inbox and context extensions, and the plugins' extensions. The worktree guard is not among them. Even if it were loaded, it would refuse nothing: `worktreeGuard` returns at once when `ARTHUR_JOB` is unset (`packages/core/src/worktree-guard.ts`).
- **Every privileged step runs in the coordinator's own process tree, as Arthur's user, outside any sandbox.** `arthur merge` (`packages/delivery/src/merge-command.ts`) pushes through `github.push` (`packages/github/src/github-git.ts` `push`). `arthur spawn` calls `systemd-run --user` (`packages/core/src/job-scope.ts:62`). The coordinator commits board files with plain `git commit` (`packages/orchestration/roles/coordinator.md`, "Commit `spec/decisions.jsonl` with the board").
- **In the setup layout, one folder is four things.** `~/arthur` is Arthur's install, the config folder, Arthur's own project's main checkout, and the parent of the home `.arthur/` (`docs/setup.md` steps 4–5).
- **`arthur.config.ts` is code.** `packages/core/src/config.ts:56` loads it with `await import(...)`, and every `arthur` command and `arthur run` load it. So any bound that still lets the coordinator write that file (or `projects/*/project.config.ts`) is escaped at the next `arthur` command or restart. The review's suggestion keeps "the config folder" writable and misses this.
- **A precedent for a broker already exists.** `arthur run` already runs `arthur merge --auto` itself, detached, with its output in a folder (`packages/delivery/src/pass-forward.ts`, AR0576). There is no other IPC between the CLI and `arthur run` (no socket server anywhere in `packages/*/src`).
- **The guard is a parser, not a sandbox.** The header of `packages/core/src/bash-refusal.ts` says "Not seen: … a program that writes (`node -e`, `tar -C`, `curl -o`) … It is not a sandbox". The real bound for jobs is `packages/core/src/job-sandbox.ts`: Landlock plus a seccomp filter that blocks new Unix sockets (so no `systemd-run`, no tmux), started through `python3`.
- **Checking `arthur send` alone closes nothing.** The coordinator can paste a file into its reply or `curl` it out, since nothing limits the network (`docs/deploy.md` threat model). Only hiding the file from reads closes that path.

The options:

**Option 1: say it in the docs.** In `docs/deploy.md`, "Threat model":
- Add a bullet saying the coordinator runs without the sandbox or the worktree guard (AR0329's decision), with every tool and your SSH keys, and with only the env guard. Outside text that reaches it (a job's final message, a review, a CI log, an issue, a project's vision) can steer it to merge, push, write or read anything Arthur's user can. Its prompt is its only bound.
- Qualify "Code reaches main only through `arthur merge`" (now line 46) as a rule for jobs and only a convention for the coordinator.
- Widen the "Text from outside … reaches a job" bullet (now line 49) to cover the coordinator.

Cost: a few lines, no code. What the owner notices: nothing changes in behaviour; the threat model becomes true. What it closes: nothing; it states the gap.

**Option 2: the review's first half, the worktree guard in the coordinator.** Core gets a coordinator mode of the guard, published like `@arthur/core/env-guard`, which orchestration loads with `-e`.
- The places it refuses: Arthur's install, every project's main checkout except its board files (`spec/build.json`, `spec/decisions.jsonl`, `spec/features/*/ticket.md`), `~/.ssh`, `~/.config/systemd` and Git config. It allows `arthur.config.ts`, `projects/*/project.config.ts` and the home.
- In main checkouts it refuses every git call that moves a ref: `push`, `send-pack`, `merge`, `pull`, `reset`, `rebase`, `cherry-pick`, `revert`, `am`, `update-ref`, `branch -f`, `checkout -B` and `switch -C`, and a `fetch` into `refs/heads`. `add` and `commit` stay allowed. The review names only four of these, and the other nine move main just as well.
- Cost: medium. `Place`, `refusal` (`path-refusal.ts`) and `bashRefusal` are built around a job (worktree, branch, root), so a coordinator mode touches all three plus `job-place.ts` [INFERENCE: one or two tickets and likely a raise of core's line budget].
- What the owner notices: refusals in the coordinator's transcript when it tries one of those steps; nothing else.
- What it closes: honest mistakes and naive steering only. An injection that says `python3 -c`, `node -e` or "write `/tmp/x.sh`, then `bash` it" walks around it. It does not touch reads (`~/.ssh`) or `arthur send`. Writes to `arthur.config.ts` still run code later.

**Option 3: the review's second half, the coordinator in a sandbox, with `arthur run` as a broker.** Corrected for the two gaps above. Built in steps:
- (a) Turning a plugin on or off becomes a command, so the coordinator never writes `arthur.config.ts` or a `project.config.ts`. This needs the owner's word; see Open questions.
- (b) Board files are committed by a command, either one of its own or the ticket and decision commands committing their own writes. The coordinator then never runs a git write in a main checkout.
- (c) The CLI, run in the coordinator's sandbox, hands each command that writes outside it to `arthur run`. That covers merge, spawn, continue, prune, ticket, decision, init, take-main, restart and `coordinator stop`. `arthur run` runs only the `arthur` CLI with that argv, in the config folder, never through a shell, as `pass-forward.ts` does, and returns its output and exit status. A command that reads a file the caller names (`send`, `transcribe`, a Dokploy upload) stays in the sandbox, marked in the command registry the way `inJob` is (`packages/core/src/commands.ts`).
- (d) `supervise` starts the agent through the job sandbox's script. It writes only its own folder in the home, the rest of the home, each main checkout's `spec/` (not `.git`), the temporary folder, `/dev` and `~/.omp`. It cannot read the env file or `~/.ssh`. It opens no Unix socket except a datagram one.
- (e) The docs are updated.
- Cost: large [INFERENCE: four or five tickets over several days].
- What the owner notices: the coordinator's `arthur` commands go through `arthur run`. It can no longer edit the config, `git commit`, `ssh` to a machine, or run anything that needs a local socket (`systemctl --user status`, `docker`, tmux). It cannot read `~/.ssh` or the env file. On a host without Landlock or `python3` it needs the same choice jobs have.
- What it closes: writes outside its places, pushes, ref moves and SSH key reads. It does not close sending any other readable file over the network (the same limit jobs have), or forged decisions, which wait for AR0482 (F1, `planned`): until then a broker runs `arthur merge --unreviewed --decision <its own word>`.

**Rejected: limit `arthur send` alone** (`packages/telegram/src/media-out.ts` checks only size and kind). The coordinator's reply text and `curl` read the same files, so a check there closes nothing.

**Recommendation:** Option 1 at once, as its own small ticket. Then Option 3, in tickets ordered after AR0482, starting with (a) and (b), which shrink the coordinator's need to write before any sandbox exists. Option 2 is not built: it costs a coordinator mode across three dense files, a crafted injection steps around it, and Option 3 makes it redundant. If the owner wants a refusal sooner than Option 3, Option 2's git-ref refusals are the part worth taking, knowing that `python3 -c` gets around them.

## Not available directly
- none

## Files
- `spec/features/AR0483-the-coordinator-the-agent-that-reads-the-most-outside-text-runs-with-no-sandbox/plan.md`: this plan, written by `arthur ticket file`, not by the worker. No other file changes.

## Risks
- **A worker spawned on this ticket finds nothing to build.** Scope says plan only, so it changes no file; every option becomes its own follow-up ticket after the owner picks.
- **The finding's line numbers have moved.** `docs/deploy.md:31/42/45` are now 35, 46 and 49, so follow-ups should name the bullets by their text, not their line.
- **Option 2 can look stronger than it is.** If built, its docs must say it is a parser, as `bash-refusal.ts` says of itself, and that the prompt stays the bound.
- **Option 3's broker can reopen reads.** A command handed to `arthur run` that reads a file the caller names gets past the sandbox's hidden paths. The registry mark keeps such commands in the sandbox, and a test per marked command should prove it.
- **Option 3 without (a) closes nothing.** A writable `arthur.config.ts` is code that the next brokered command loads outside the sandbox (`config.ts:56`).
- **Project agents (roadmap entries 85–88, not yet in `packages/*/src`) are coordinator-like.** Whichever option is chosen must apply to them when they are built.

## How to test
- Done means 1 (`plan.md` lists the options, each with its cost and what the owner would notice, and a recommendation; the review's suggestion is one option): after filing, `arthur plan AR0483` prints this file. Options 2 and 3 are the review's two halves; Option 1 is its "say in `docs/deploy.md`" part.
- Done means 2 (no code; `npm test` and `npm run check` pass):
  - `git diff --stat` after filing shows only `plan.md`.
  - At HEAD of this checkout, `npm run check` (tsc) finished clean in 6 s.
  - At HEAD, `npm test` gave 1647 tests: 1583 passed, 0 failed, 64 skipped, in 460 s.
  - The worker runs both again after filing, each in one call with a timeout of 1800 s (3600 s for `npm test`).

## Open questions
- Which option or options are wanted? Recommended: Option 1 now, then Option 3 in steps after AR0482, with Option 2 not built.
- AR0329's decision says the coordinator turns a plugin on in `arthur.config.ts` and restarts. The file is code that `arthur run` imports, and it sits in Arthur's install. May turning a plugin on go through a command (Option 3a), with every other config edit left to the owner? Or does the coordinator keep editing the file by hand, which leaves Options 2 and 3 escapable at the next config load?
- Under Option 3, on a host where the sandbox cannot be set up (macOS, no `python3`): should the coordinator refuse to start unless the owner opts in, as `core.jobs.unsandboxed` does for jobs, or start bare with a warning?