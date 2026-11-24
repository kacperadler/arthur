# AR0716 - Review 2

- Job: 2026-11-24-review-057680c6
- Branch: arthur/2026-11-23-worker-f865eac7
- Commit reviewed: 8c3a514796fc335b4a271e81480ecf4ce67f2f9c
- Verdict: PASS

## Final message

The branch can merge as it is. I found nothing that fails it against the AR0716 ticket or the review criteria.

- **Role text:** `packages/orchestration/roles/project.md:9` tells a project agent to write the owner's steps to `$ARTHUR_SESSION_FOLDER/after-restart.md`. The live agent does get that variable: the session plugin hands it over at `session.ts:65`, and orchestration passes it to the tmux session with `-e` (`coordinator.ts:142-144`).
- **Handoff texts:** both now say "this session restarts…". They are pinned in `handoff-extension.test.ts:37-38` and the `ask` helper in `restart-setup.ts:18`. The remaining "the coordinator restarts" strings are `arthur run` log lines, not the handoff requests. The worker already filed the other two coordinator-only texts in the extension as F2.
- **New scenario:** `session/after-restart-agent` uses the same fixture and stub as `after-restart-plan` (`diff -r` and a `jq` comparison show them identical apart from `agent` and `expect`). It expects the file in `.arthur/session/agents/arthur/` and none in `.arthur/session/`. `scenarios.test.ts` plays its right and its wrong turn.
- **Changes outside Scope In:** the new `agent` key in develop's eval runner, and `agent` on orchestration's `coordinator.checkoutContext`. Without them `arthur eval` can only play the coordinator, so the scenario the ticket's Done means asks for could not exist. Docs are updated in the same diff: `eval.md`, `coordinator.md`, `docs/plugin-api.md`, `spec/roadmap.md` 67 and 68, and `restart.md`.
- **`agent` path check:**
  - The regex at `eval-scenario.ts:79` refuses absolute paths, `.`, `./`, `a/..`, `./..` and every `..` route out of the repository, whatever folder the eval runs in.
  - `..foo` is still accepted; it is a normal folder name inside the repository.
  - `eval-run.ts:136-137` resolves the first part of the path that exists. A fixture link anywhere on the path makes the real path differ, and the run fails before any folder is made. A link to nothing fails with Node's own error.
  - A live `ARTHUR_SESSION_FOLDER` never reaches a turn without `agent`: when `own` is undefined, Node's spawn drops the variable, and `eval.test.ts:318` checks this.
  - The worker filed the same link gap in the stub's `files` as F4.
- **Line budget:** develop goes from 760 to 769, and the worker's message says so. All changed source files stay green (155 lines or fewer).

## Notes
- (minor) packages/develop/src/eval-run.ts:134-137: the link check also runs without `agent`. With `at = repo` it can never fail there, because the run's folder is already a real path; guarding it on `own` would make that plain.
- (minor) packages/develop/src/eval-run.ts:137: a fixture link to nothing fails with Node's `ENOENT …/repo/.arthur`, which names neither `agent` nor the link. This is documented in `eval.md:45` and tested.
- (risk) packages/develop/src/eval-run.ts:141: a project agent's eval turn has no `ARTHUR_PROJECT`, though `project.md:10` says Arthur sets it. It does not affect scoring, but the turn differs from a live agent's. This sits next to F3 (wrong model), not inside it.
- (minor) Outside the range: after this review's `npm run mutate` runs, a core `wrapper.ts` and `fake-agent.ts` from this checkout, plus two `omp` fakes under `/tmp/arthur-test-*`, were still running 20 minutes later under `systemd --user`. I killed those four (357927, 358040, 358061, 358178).

## Checks (commit 8c3a5147, clean tree)
- `npm run mutate`, run twice: the first call gave 50 mutants, 49 caught, 1 survived, 16 not run (time); the second, with nothing left unrun, gave 66 mutants, 65 caught, 1 survived. The survivor is `packages/orchestration/src/context.ts:45: hunk reverted to the base`. That line is only the type of `scope.checkout`, so `tsc` catches it, not the tests.
- Hand mutations, each restored with `git checkout --`; every one was caught:
  - link check disabled (`if (false) throw`, `eval-run.ts`): `eval.test.ts` 1 fail; the run made `repo/.arthur/session/agents/shop` instead of refusing it.
  - root refusal narrowed (`/^\.\.?(\/|$)/` changed to `/^\.\.(\/|$)/`, `eval-scenario.ts`): `eval.test.ts` 11 pass, 1 fail.
  - `agent: agent !== undefined` changed to `agent: false` (`eval-command.ts`): `eval.test.ts` 11 pass, 1 fail.
  - role always `"coordinator"` (`checkout?.agent !== true` changed to `true`, `context.ts`): `context.test.ts` 10 pass, 1 fail.
- `npm run check`: `tsc` printed no error.
- `npm test`: 1924 tests, 1860 pass, 0 fail, 64 skipped.

PASS