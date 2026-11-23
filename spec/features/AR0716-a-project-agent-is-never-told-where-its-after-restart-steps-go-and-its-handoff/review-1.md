# AR0716 - Review 1

- Job: 2026-11-23-review-b4355a9a
- Branch: arthur/2026-11-23-worker-f865eac7
- Commit reviewed: edcd4f4f9445d7e45bd16a38abef71f265e80ea8
- Verdict: FAIL

## Final message

I'm failing this branch. The new check on a scenario's `agent` path can be bypassed, which makes the documented "fails the scenario" refusal untrue. `isAbsolute` can also be removed without any test failing.

## Findings

1. **`packages/develop/src/eval-scenario.ts:79`: the refusal of an `agent` path outside the repository can be bypassed.** The check runs `relative(".", agent)`, which resolves `agent` against `process.cwd()` (the checkout `arthur eval` runs in), not against the run's repository. Any path that climbs out with `..` and comes back down through the cwd's own name is accepted. `packages/develop/src/eval-run.ts:135` then runs `join(repo, scenario.agent)`, makes that folder, and puts it in the turn's `ARTHUR_SESSION_FOLDER`. I fed the exact expression three paths, from this checkout's cwd:
   - `"../2026-11-23-review-b4355a9a/x"` is accepted and lands in `/tmp/arthur-eval-1/2026-11-23-review-b4355a9a/x`, outside the repo.
   - `"../../.arthur-worktrees/2026-11-23-review-b4355a9a/x"` is accepted and lands in `/tmp/.arthur-worktrees/2026-11-23-review-b4355a9a/x`. That is outside the run's folder, so the folder and whatever the agent writes there stay behind after the run is removed.
   - `"../session"` is refused.

   So the run's doc, `packages/develop/docs/commands/eval.md:45` ("A path that … is not inside the repository (… one that leaves it through `..`) fails the scenario"), is wrong. A `scenario.json` is a file a human edits, so this is a trust-boundary check. The `wrong` list in `packages/develop/test/eval.test.ts:334` only tries paths that leave through a leading `..` after normalising, so it cannot catch this.
   - Fix: test the normalised path itself, e.g. `normalize(agent)` starting with `..` or equal to `.`. Add a case that comes back down through the cwd's name.

2. **`packages/develop/src/eval-scenario.ts:79`: removing `isAbsolute(agent) ||` does not fail any test.** I ran `packages/develop/test/eval.test.ts` with it removed: 12 pass, 0 fail, then restored it with `git checkout`. The test's `/tmp/session` is still refused, but only because `relative(".", "/tmp/session")` happens to start with `..` from the test's cwd. Once finding 1 is fixed (the check no longer depends on the cwd), the absolute-path refusal needs a test that fails without it.

## Notes
- (minor) `packages/orchestration/src/context.ts:45`: the one `npm run mutate` survivor ("hunk reverted to the base") only changes the type of `checkout`, so it doesn't change behaviour under type stripping. Reverting it fails `npm run check`, as the worker reported. Not a missing test.
- (minor) `packages/session/docs/commands/restart.md:28`: still says `after-restart.md` is "written by the coordinator". The project role now tells a project agent to write its own file. The line is not in the diff.
- (risk) Outside the range: my `npm test` run left two `packages/core/src/wrapper.ts` processes running under `/tmp/arthur-test-sUj2Fi/`, the same kind of leftover the worker reported. I stopped them with `kill <pid>`, and `ps` then listed none.

## Checks (all on `edcd4f4f`, clean tree)
- **`npm run mutate`:** the first call gave 58 mutants, 57 caught, 1 survived, 4 not run (time). The second call gave 62 mutants, 61 caught, 1 survived. The survivor is `packages/orchestration/src/context.ts:45: hunk reverted to the base`.
- **Hand mutation** (`isAbsolute(agent) ||` removed from `eval-scenario.ts:79`): `node --import @arthur/core/testing --test packages/develop/test/eval.test.ts` gave 12 pass, 0 fail, so it survived. I restored it with `git checkout`.
- **Bypass probe** (`node -e`, the exact `isAbsolute` + `relative(".", …)` expression): the two paths above came back `accepted: true`, and `"../session"` was refused.
- **`npm run check`:** tsc printed no error.
- **`npm test`:** 1924 tests, 1860 pass, 0 fail, 64 skipped.
- **Diff contents:**
  - The `after-restart-agent` fixture is identical to `after-restart-plan`'s (`diff -r`). Its `scenario.json` differs only by `agent`, the expected file's path, and the `missing` entry.
  - The handoff texts and `project.md` match the ticket's Done means.
  - No stale "goes on with this one" or "the coordinator restarts in a fresh conversation" request text is left in any doc, role or test.
  - The worker's message explains the scope beyond In and the develop budget going from 760 to 766.

FAIL