# AR0443 - Plan

- Job: 2026-10-26-plan-b0faa57e
- Planned at: a41ce1a91849c738494ed5c2ccbd57a7adcd8c9a

## Approach
Make the env file unreadable from inside a job's sandbox. Then have Arthur's CLI, when it runs inside a job, never read that file. Two changes in the core, plus a test and docs.

1. **The sandbox hides the env file.** Today the Landlock ruleset in `packages/core/src/job-sandbox.ts` (`SCRIPT`) limits writes only. It will also handle Landlock's read right for files (`READ_FILE`, bit 2) and allow reading everywhere except the env file. The wrapper takes the file's path from the job record's `guarded` file, the `env <path>` line `guardedPlaces` already writes there (`job-place.ts`). Every process of the job, a CLI run with a config and home of its own included, then gets `Permission denied` on that file: by its path, through a symlink, or after `sed -i` gives it a new inode. Writes stay exactly as they are now.

2. **Inside a job the CLI does not read the env file.** If nothing else changed, hiding the file would break every `arthur` command a job may run against the real config. Loading the plugins reads the env file (`host.ts` `loadPlugins` → `env.ts` `resolveEnv`), an unreadable file refuses the load (`cannot be read (EACCES)`), and only the core's commands would remain. That would also break `arthur plugin new` from the checkout, which AR0329's Decision says must keep working.
   - So when `insideJob(home)` names a job, the CLI loads the plugins without reading the env file. Values come from the shell only, and a missing variable is no refusal.
   - A plugin with an `...Env` variable not set is left out, together with any plugin that requires it, and one stderr line names them.
   - On this install the plugins left out are `github` and `telegram`. `board`, `findings`, `plugin new`, `jobs`, `health` and the rest still run.
   - A job that clears `ARTHUR_JOB` and writes a home of its own is a coordinator to the CLI. It then reads the env file as now, and the sandbox refuses the read.

Left alone:
- `insideJob` itself.
- The env guard and the worktree guard.
- Every plugin's code.
- The config folder, which stays readable (`arthur plugin new` runs from it).
- Hosts without the sandbox: they stay a documented limit.
- The install step and the merge checks, which run outside the sandbox: AR0449's.

AR0440's half is already closed and merged (`6ce62c51`, AR-D64: the Landlock domain refuses `/proc/<pid>/environ`). This plan uses the same sandbox for the file. The plan follows Option 1 below.

## Not available directly
- **Landlock has no rule that denies one path.** Its rules only grant rights, and a right the ruleset handles is refused wherever no rule grants it (`SCRIPT` in `packages/core/src/job-sandbox.ts`, as written for writes). So "readable everywhere but the env file" has to be built: walk from `/` to the env file's real path, and at each folder on the way grant read to every entry but the next part of the path.
  - I ran this as a throwaway `python3 -I -c` inside this planning job's own sandbox (kernel 6.8, nested domain):
    - the hidden file and a symlink to it gave `Permission denied`;
    - a file next to it read `ok`, and `ls` of its folder listed names;
    - `node`, `git` and `/proc/self/cgroup` worked;
    - a file created later directly in a folder above it was refused.
  - With the file under `/tmp` the walk made 31848 rules and took about 0.6 s. For the real `~/.config/arthur/.env` it walks `/`, `/home`, `~`, `~/.config`, `~/.config/arthur`, which is a few dozen rules.
- Option 1: the "everything but the env file" read rule in `SCRIPT`, plus the in-job load without the env file - cost about 20 core lines and a budget raise, risk: during that job's run, files created later directly in a folder above the env file (`~`, `~/.config`) can't be read either, and jobs lose the commands that need a token.
- Option 2: jobs as another Linux user, with the env file mode 600 for Arthur's user - cost very large (spawn, wrapper, remote jobs, worktree and Git permissions, omp logins per user, a privileged switch), risk: broken permissions, and a setuid or sudo helper.
- Option 3: no code change; the threat model keeps naming it (it does today, `docs/deploy.md:40`, "F1 of AR0354") - cost none, risk: a steered job keeps using the GitHub and Telegram tokens.
- Recommendation: Option 1

## Files
- `packages/core/src/job-sandbox.ts`:
  - `SCRIPT` takes the hidden paths between a second `--` and the agent's command line. It adds `READ_FILE` (1 << 2) to the handled rights; the write rules keep their masks without it.
  - For each hidden path, after `os.path.realpath`, it walks from `/`: at each folder it grants `READ_FILE` on every entry but the next part, opened `O_PATH | O_NOFOLLOW`, skipping symlinks and entries that fail to open. It stops at the first part that does not exist, so a file made there later stays hidden.
  - A folder that cannot be listed gets no read rule for its entries: reads fail closed, never the sandbox.
  - New `hidden(record)`: the `env` line of `<record>/guarded`, or nothing (an old record, a job on another machine).
  - `sandboxed(paths, hidden, agent, argv, note)` passes it to the probe and the start. The note gains `, reads every file but <path>` only when something is hidden, so the existing exact log line for `[]` stays as it is.
- `packages/core/src/wrapper.ts:129`: `sandboxed(writable(folder, worktree, extensions), hidden(folder), agent, argv, note)`. Same line; the file is at 200 lines.
- `packages/core/src/env.ts`: `checkEnv` and `resolveEnv` take `inJob`.
  - When it is set, `readEnvFile` is not called. A variable not set in the shell is no refusal, and `resolveEnv` also returns the plugins that have one unset.
  - Name and prefix problems still refuse.
- `packages/core/src/host.ts`: `loadPlugins(config, shell, commands, inJob = false)`.
  - With `inJob`, the `sorted` loop skips a plugin with an unset variable, or one whose `requires` names a skipped plugin.
  - When any is skipped, one `console.error` line: `arthur: inside a job, not loaded: <names>: each names an env variable, and a job's CLI reads no env file`.
- `packages/core/src/cli.ts` `load()`: `loadPlugins(config, process.env, commands, insideJob(config.core.home) !== undefined)`. Same line; the file is at 200 lines.
- `packages/core/test/sandbox.test.ts`:
  - Update the `inside` helper and the test at line 112 for the new `sandboxed` signature.
  - Add the new end-to-end test described under How to test.
- `packages/core/test/host.test.ts`: one test of the in-job load:
  - an env file that is a folder is not refused, since it is not read;
  - a plugin whose variable is only in the file is not set up, nor one that requires it; the rest are, and the stderr line names the two;
  - a variable set in the shell still loads its plugin.
- `test/structure.test.ts`: the core budget raised from 6238 by the counted delta, after the owner's decision.
- `packages/core/docs/commands/spawn.md` ("The sandbox", line 116 "Everything else can be read…"): every file can be read but the env file (`Permission denied`, also through a link). The cost: a file made during the run directly in a folder above it.
- `docs/deploy.md`:
  - line 33: "a program a job runs can still read any file you can" gains "but the env file, where the sandbox stands";
  - line 40: the F1 sentence becomes "and the env file it would need is closed to it";
  - line 42: "nothing confines reads of files" gains "but the env file".
- `packages/core/docs/commands/config.md:15`: inside a job the env file is not read; a plugin with an unset variable is not loaded there.
- `packages/core/docs/commands/help.md:11`: the same, after the list of in-job commands.
- `packages/github/docs/commands/ci.md:26`: "where `arthur ci <branch>` still reads the run" becomes "when its token is in the job's shell; otherwise github is not loaded in a job".

## Risks
- **Jobs lose the commands that need a token.** `arthur ci <branch>` (github) and `arthur youtrack issue get` stop working inside a job. A job and its tokens cannot be split while the token sits in the job's process. I found no job role or job prompt that runs them: the grep of `packages/core/roles` and `packages/orchestration/roles` found them only in `coordinator.md`. The youtrack prompt only forbids writes. `[INFERENCE]` that no job needs them. See Open questions.
- **Files made later right above the env file can't be read.** During that job's run, a file created directly in `~` or `~/.config` is unreadable to it, as the probe showed. A job cannot write there anyway.
  - In tests the env file lies under `/tmp`, so a test agent that creates a new entry directly in `/tmp` or in the test's folder could not read it back. Existing sandbox tests write into their record or a `TMPDIR` made before the spawn (`sandbox.test.ts:187`).
  - The full suite run inside the worker's job is the check.
- **Hard links.** A hard link made in `$TMPDIR` would carry a readable path. Landlock refuses linking out of a folder that has no `REFER` right (ABI 2 and later, in `dirs` already; ABI 1 refuses any reparenting). `[INFERENCE]` from Landlock's documentation; the new test tries it.
- **Tests that read the owner's real env file.** A test that runs the CLI without its own `XDG_CONFIG_HOME` reads the real `~/.config/arthur/.env` today. Inside a worker's sandbox it would now get EACCES. Running `npm test` inside the worker's job finds such a test; it is a test bug to fix by giving it its own file.
- **A skipped plugin's provider is missing.** A loaded plugin's in-job command that calls a skipped plugin's provider (for example `github.ci`) gets what it gets when that plugin is disabled.
- **Branch code outside the sandbox still reads the env file.** The install at a job start and the merge checks run outside it (AR0449). AR0449 should pass the same hidden path once both land (Open questions).
- **The core is at its line budget.** 6587 − 349 = 6238 lines, which is exactly the budget (`test/structure.test.ts:712`), so a raise is needed. `cli.ts` and `wrapper.ts` are at 200 lines each, so their edits stay on the same line.
- **Hosts without the sandbox** (macOS, no `python3`) are unchanged: a job reads the env file there. The docs keep saying so.

## How to test
- **The plan first, together with AR0440's, and the owner picks:** this plan. AR0440 is merged with the Landlock domain (AR-D64), and this plan closes the file with the same sandbox (Not available directly, Open questions).
- **A job's command with a config and home of its own and `ARTHUR_JOB` cleared cannot read a token:** a new test in `packages/core/test/sandbox.test.ts`, `{ skip: bare }`.
  - **Setup:** `repository()` and a "real" env file at `join(folder, "private", "arthur-env")` (not named `.env`, so the env guard never meets it in a tool call). The file holds `ARTHUR_SECRET_TOKEN=s3cret-t0ken`.
  - **The real config:** a config in `folder` with that `envFile` and the test's `home`, with three plugins:
    - `orchestration`;
    - `secret` (`tokenEnv: "ARTHUR_SECRET_TOKEN"`, an inJob command `leak` printing it);
    - `plain` (an inJob command printing `plain ran`).
  - **Before the spawn:** the test runs `node <cli.ts> plain` once in `folder`, so the plugins' folders exist as `arthur run` makes them.
  - **The spawn:** `jobRunner(home, root, <that env file>, …)`.
  - **The agent script, each output into `$ARTHUR_JOB`:**
    - `cat` of the file, of a symlink to it in `$TMPDIR`, and of a hard link `ln` tries to make there;
    - in `folder`, `node <cli.ts> plain` and `node <cli.ts> leak`;
    - in `$PWD/own` (the worktree), a copy of the config with home `./home`, then `env -u ARTHUR_JOB node <cli.ts> leak`.
  - **Asserts:**
    - every read gives `Permission denied` or a refused `ln`, and no output holds `s3cret-t0ken`;
    - `plain ran`;
    - `leak` is an unknown command, with the `not loaded: secret` line;
    - the attack prints `<env file>: cannot be read (EACCES)`;
    - the log holds `reads every file but <env file>`.
  - **Control:** the test's own `env -u ARTHUR_JOB node <cli.ts> leak` in that `own` folder, outside the sandbox, prints the token.
  - Run with `node --test --test-name-pattern "<name>" packages/core/test/sandbox.test.ts`.
- **The test catches the bug:**
  - Temporarily pass `[]` instead of `hidden(folder)` at `wrapper.ts:129`: the test must fail with the token in the attack's output.
  - Temporarily pass `false` at `cli.ts` `load()`: the `plain ran` assertion must fail (the load refuses).
  - Restore both.
- **The in-job load:** the new `host.test.ts` test.
- **`npm test` and `npm run check` pass:** run both from the worker's own job. That run is inside its sandbox with `ARTHUR_JOB` set, so it also finds a test that inherits `ARTHUR_JOB` or reads the real env file. `test/structure.test.ts` must pass with the raised budget.
- **Live, after the deploy:** from inside a job, a read of `~/.config/arthur/.env` gives `Permission denied`, and `cd ~/arthur && node_modules/.bin/arthur board` still prints the board.

## Open questions
- Which option do you pick? I recommend Option 1: the sandbox hides the env file and a job's CLI reads none. The alternatives are jobs as another Linux user (very large) or leaving it as the documented limit.
- Do you accept that inside a job the plugins needing a secret are not loaded? On this install that is `github` (so `arthur ci`) and `telegram`, and `youtrack` wherever it is configured. The coordinator keeps them and passes their text to a job. I recommend yes; a job cannot hold a token without being able to use it.
- Do you raise the core line budget from 6238 by the counted delta (about 20 lines)? The number gets recorded under the ticket's Decisions.
- Should AR0449, whose install step and merge checks go into the sandbox, hide the env file there too, by passing the same `hidden` path? I recommend adding that to AR0449's Done means; until then branch code run by those two steps can still read the file.