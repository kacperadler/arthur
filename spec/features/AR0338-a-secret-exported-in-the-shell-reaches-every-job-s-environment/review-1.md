# AR0338 - Review 1

- Job: 2026-10-25-review-88629edb
- Branch: arthur/2026-10-25-worker-edc68b52
- Commit reviewed: 2911b93f62fc29f4cd978210d7904d1dc672626e
- Verdict: PASS

## Final message

**Findings**

None block the merge. The branch does what AR0338's Done means asks: a token exported in the shell no longer reaches a job's environment. The worker gives a reason for each of its three departures from the ticket, and each one holds up:

- **No `checkEnv(...).variables` list handed to `launch`.** `packages/core/src/job-scope.ts:68` drops every `ARTHUR_` key of `process.env`. That covers the list the ticket asked for:
  - `nameProblem` (`env.ts:102`) refuses any `...Env` name that does not match `^[A-Z][A-Z0-9_]*$` and start with `ARTHUR_`.
  - `resolveEnv` throws on any such problem before anything starts.
  - So every variable the config can name is an `ARTHUR_` one. The job's own `ARTHUR_JOB` is added later by the wrapper, and the prepares' variables are spread after the filter, so both survive.
- **`wrapper.ts:129` unchanged.** `launch` is the only place that starts `wrapper.ts`: local spawn, `continue` (`job-control.ts:109`) and `remote-job launch` (`remote-job.ts:56`). `systemd-run --scope` keeps the environment of the process that calls it, so the wrapper already gets the filtered one. Filtering again in the wrapper would drop the `ARTHUR_` variables a prepare returns on purpose, which `spawn.md` promises the agent gets.
- **Test in `model.test.ts`, not `scope.test.ts`.** The worker widened the existing `ARTHUR_AGENT_MODEL` test, which already has an agent that dumps `env`, instead of copying it. Its assertion covers exactly what Done means names:
  - the token absent;
  - `ARTHUR_JOB` and the prepares' variables present, `ARTHUR_` ones among them;
  - `PATH` still there.

**Notes (non-blocking)**

- **Behaviour change.** A variable set only in the shell now counts as missing for every `arthur` command a job runs that loads the config. This follows from what the ticket asked. It is documented in `config.md` and filed as F1. I reproduced it (see checks).
- **Accepted gap.** Provider keys without the `ARTHUR_` prefix, such as `ANTHROPIC_API_KEY`, still reach jobs. Done means only asks to drop `ARTHUR_` and `...Env` variables, so this is within scope. It is filed as F2.
- **Small duplication.** The filter expression is the same as `packages/develop/src/eval-run.ts:135`. The styleguide prefers duplicating a short function over a shared helper, so this is fine.
- **Outside the range:** a job can still read the running Arthur process's secrets from `/proc/<pid>/environ`. Landlock in `job-sandbox.ts` only limits writes, and a throwaway check showed a process with an empty environment reading another same-user process's `/proc/<pid>/environ`, `ARTHUR_DEMO_TOKEN` included.

**Checks run**

- `npm ci`: added 22 packages.
- `npm run check` (tsc): clean.
- `npm test`: 1128 tests, 1070 pass, 0 fail, 58 skipped.
- Mutation tests on `job-scope.ts:68`, each run against the new test, each restored with `git checkout -- packages/core/src/job-scope.ts`, tree clean at the end. All four were caught:

  | Mutation | Result |
  |---|---|
  | Filter only `key !== "ARTHUR_AGENT_MODEL"` | fails, `ARTHUR_TEST_TOKEN=shell-t0ken` in the dump |
  | Filter applied after merging the prepares' variables | fails, `ARTHUR_MODELS_HINT` missing |
  | `...env` (the prepares' variables) dropped | fails, only `ARTHUR_JOB` left |
  | Arthur's environment dropped entirely (`env: { ...env }`) | fails, no `PATH` |

  My first run of mutations 2–4 went in parallel and raced on the same file, so I threw those results away and reran each one on its own; the table shows the reruns.
- Worker's `config.md` claim, in a throwaway `/tmp` folder (removed afterwards) whose config names `ARTHUR_YOUTRACK_TOKEN`, run with `env -i … ARTHUR_JOB=… cli.ts jobs`:
  - without the token: `ARTHUR_YOUTRACK_TOKEN is missing: not in the shell nor in …/.env, which does not exist`, exit 1;
  - with it: `no jobs`, exit 0.
- `job-scope.ts` is 181 lines, under the 200 limit. The structure tests pass within `npm test`.

PASS