# AR0440 - Plan

- Job: 2026-10-26-plan-32afc87a
- Planned at: 0a2efac43524b985e769df464fac2cfa25abf07a

## Approach
The hole is already closed wherever a job runs in its sandbox. The fix is a test that proves it and docs that say it. No Arthur source file changes.

What I found:
- The sandbox's Landlock ruleset (`packages/core/src/job-sandbox.ts`, `SCRIPT`) puts the agent and every process it starts in a Landlock domain. A process in a domain cannot open the ptrace-guarded files of a process outside that domain. Those files are `/proc/<pid>/environ`, `mem`, and the `cwd` link.
- I checked this from inside this planning job, which runs in the sandbox (`NoNewPrivs: 1`, scope `arthur-job-2026-10-26-plan-32afc87a.scope`). `wc -c /proc/<pid>/environ` gave `Permission denied` for every process I tried:
  - the live `arthur run` (pid 2775665, `node …/arthur run`);
  - this job's own wrapper (pid 2853068);
  - the coordinator's tmux server and its `omp`;
  - the `omp` processes of other jobs.
  This job's own environment read fine (3148 bytes).
- A throwaway run with the real `jobRunner`, wrapper and sandbox showed the same: a runner process started with `ARTHUR_TEST_TOKEN=shell-t0ken` read the token from its own `/proc/<pid>/environ`, and the job's agent reading that same file got `Permission denied`.
- The reviewer's probe in `spec/features/AR0338-…/review-1.md` ("a process with an empty environment") ran outside any sandbox. A bare process can read the file, as my bare control run also did.

The four ways the ticket names, with their cost:
1. **A `hidepid` mount of `/proc`.** System config only, but it does not close the hole. `hidepid` hides the processes of other users, and a job runs as the same user as Arthur.
2. **Jobs as another Linux user.** This closes it even where there is no sandbox, but costs a lot: a second user, group permissions on worktrees, records and Git objects, omp logins per user, systemd scopes under another user's manager, and a sudo or setuid step. It touches spawn, the wrapper, `remote-job` and the setup docs.
3. **Arthur's processes clear secrets from their environment once loaded.** This cannot be done in Node; see Not available directly.
4. **A Landlock read rule on `/proc/<pid>`.** Not needed: the existing Landlock domain already refuses these reads. A file read rule would also mean listing every path a job may read.

Recommendation: way 4 as it already stands.
- Pin it with the test the Done means asks for.
- Fix the docs that say nothing confines reads: say that a job cannot read the environment or memory of a process outside its sandbox, and name where that does not hold.

Left alone:
- `job-sandbox.ts`, `wrapper.ts`, every runtime file and all behaviour. The core is at its line budget (6228 counted, 6228 allowed in `test/structure.test.ts`), and no code line is needed.
- The env file on disk (out of scope; AR0443 covers it).
- Branch code that runs outside the sandbox: the wrapper's install step and the merge checks (see Risks and Open questions).

## Not available directly
- **Clearing a secret from a running Node process's `/proc/<pid>/environ`.** That file shows the environment as it was when the process started. `delete process.env.X` (unsetenv) removes the variable from `process.env` but leaves its bytes in the file. Tested on Node v24.21.0: after `delete`, `"ARTHUR_DEMO_TOKEN" in process.env` was false, and `/proc/self/environ` still held `demo-s3cret`. The only way to get a clean environment is to replace the process with `process.execve` (present in this Node).
  - Option 1: keep the Landlock domain that is already there, add the test and fix the docs - cost: one test and two doc edits, risk: no new protection on hosts without the sandbox, which the docs then name.
  - Option 2: `arthur run` restarts itself through `process.execve` without its `ARTHUR_` variables, early in `cli.ts` - cost: about 10 core lines and a budget raise, risk: a secret set only in the shell is lost (the documented setup keeps none there: `docs/setup.md` step 8 puts only `PATH` in `arthur.env`), and provider keys without the `ARTHUR_` prefix (AR0439) stay.
  - Option 3: jobs as another Linux user - cost: very large, across spawn, wrapper, remote jobs and setup, risk: broken permissions and a privileged helper to switch users.
  - Recommendation: Option 1

## Files
- `packages/core/test/sandbox.test.ts`: one new test, skipped where the sandbox is unavailable (`skip: bare`, the existing probe; my run showed a job spawned here works inside a worker's own sandbox):
  - A child `node --input-type=module -e` process, started with `{ ...process.env, ARTHUR_TEST_TOKEN: "shell-t0ken" }`, plays `arthur run`. It runs `jobRunner` on the `repository()` helper's repo and home, with `jobs.prepare("test", () => ({ RUNNER_PID: String(process.pid) }))`. It spawns one job and stays alive until the test kills it in `t.after`.
  - The test-side setup puts the token in the runner's environment when it starts. This matters because `Object.assign(process.env, …)`, as `model.test.ts` uses it, never reaches `/proc/<pid>/environ`.
  - The agent is a script like `{ tr '\0' '\n' < /proc/$RUNNER_PID/environ || echo refused; } > "$ARTHUR_JOB/read" 2>&1`.
  - The test waits for `job-ended`, as the neighbouring tests do with `until`, then asserts:
    - `read` holds `Permission denied` and no `shell-t0ken`;
    - the job's `log` has the `sandbox: the agent writes only in …` line;
    - the test's own read of `/proc/<runner pid>/environ`, taken while the runner lives, holds `ARTHUR_TEST_TOKEN=shell-t0ken`. This control shows the secret is there for a process outside the sandbox.
- `packages/core/docs/commands/spawn.md`, "The sandbox":
  - After "Everything else can be read and not written…", add that no process in the sandbox can read the environment or memory of a process outside it: `arthur run`'s, the wrapper's, the coordinator's, another job's (`/proc/<pid>/environ`, `mem`, `Permission denied`). `/proc/<pid>/cmdline` stays readable.
  - In the "Where the sandbox cannot be set up" limits, add that without the sandbox a job reads the environment of every process of the user, so a secret belongs in the env file, never exported in Arthur's environment.
- `docs/deploy.md`, threat model:
  - Line 41: "nothing confines reads" becomes "nothing confines reads of files", plus the process sentence above.
  - Line 33 ("a program a job runs can still read any file you can") gains the same caveat for hosts without the sandbox.

## Risks
- **The test is only a stand-in for `arthur run`.** The real daemon is not started in it; the runner child runs the same `jobRunner`, wrapper and sandbox code, started with the secret, as the daemon is. This avoids `run.test.ts`'s plugin config, fake `systemctl` and orchestration. The live check above covers the real `arthur run` here.
- **The test never runs on a host without Landlock or `python3`** (`skip: bare`, as the other sandbox tests). It does run inside a worker's or reviewer's sandbox: the nested domain still refuses the runner, and the runner and the test share a domain, so the control read works. I ran this design inside this job's sandbox and it behaved as described.
- **Hosts without the sandbox** (macOS, no `python3`, a kernel without Landlock) stay open: there a job reads every same-user process's environment. The log already says `no sandbox: <why>`; the docs will now say what that means for secrets.
- **Branch code that runs outside the sandbox can still read Arthur's environment.** This is inferred from the bare run above (an unsandboxed child read both its parent's and an unrelated sibling's environment), not tested on these paths:
  - the wrapper's install step (`packages/core/src/job-install.ts`, `install`, called at `wrapper.ts:123` before `sandboxed`), which runs the project's install and its lifecycle scripts in the worktree;
  - the merge checks (`packages/delivery/src/merge-checks.ts`, `stepRunner`), which run install, `npm run check` and `npm test` of the merged main.
  Not changed here (see Open questions).
- **`cmdline` is not refused by Landlock.** I found no Arthur process that carries a secret in its command line: the coordinator's `tmux new-session -e` passes only `ARTHUR_ORCHESTRATION_*` and `ARTHUR_SESSION_FOLDER` (`packages/orchestration/src/coordinator.ts:116`). The doc line states this.
- **Line budget.** No source line changes, so the core stays at 6228.

## How to test
- **The plan with ways, costs and a recommendation:** this plan (Approach, Not available directly). The owner picks before a worker starts.
- **A job's command reads `/proc/<arthur run's pid>/environ` and gets no secret:** the new test in `packages/core/test/sandbox.test.ts`, run with `node --test --test-name-pattern "<its name>" packages/core/test/sandbox.test.ts`. Expected:
  - `read` holds `Permission denied` and no `shell-t0ken`;
  - the control read holds the token.
- **The test catches the bug:** temporarily make `sandboxed` in `packages/core/src/job-sandbox.ts` return `[agent, [...argv]]`. The test must fail with `ARTHUR_TEST_TOKEN=shell-t0ken` in `read`. Restore the file afterwards.
- **Live check on the deployed service:** from inside any job on the VPS, `wc -c /proc/$(cut -d' ' -f1 <home>/run.pid)/environ` prints `Permission denied`. I ran this here against pid 2775665.
- **The full checks:** `npm run check` and `npm test` pass, including `test/structure.test.ts` with the core still at 6228.

## Open questions
- Which way do you pick? The ticket asks for this before a worker starts. Recommended: the Landlock domain already in place, plus the test and the docs. Alternatives: `arthur run` restarting itself without its `ARTHUR_` variables (about 10 core lines and a budget raise; a secret exported only in the shell is lost), or jobs as another Linux user (large).
- The wrapper's install step (`job-install.ts`) and the merge checks (`merge-checks.ts`) run code from a branch outside the sandbox, where it can read the environment of `arthur run` and the coordinator. Should that be a separate ticket? I recommend yes; it is left out of this one. Putting those steps in the sandbox would block writes to the package-manager caches (`~/.npm`, `~/.bun`) unless they are added to its writable paths.
- On a host without the sandbox, is a doc line enough (recommended), or should `arthur doctor` warn, or a spawn be refused there?