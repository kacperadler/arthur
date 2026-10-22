# AR0276 - Review 1

- Job: 2026-10-22-review-ar0276-evals-runn-e750b748
- Branch: h/2026-10-22-ar0276-evals-runner-eda48620
- Commit reviewed: df54dec4dec113dd9da93615d73ce6856f8420f6
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

**Findings:** none blocking.

**Notes (non-blocking):**
- F1–F3 in `findings.md` are real, correctly scoped as out-of-ticket (orchestration-text duplication, `--help` inside a run, missing live context/hour) — left open for entry 68/later, as the ticket allows.
- `evals.baseline` first-use test in `eval.test.ts:234` intentionally uses baseline keys without the `<package>/` prefix to exercise "scenarios left out keep their rate," not a naming bug — verified by the second write in the same test using correctly prefixed keys.

**Checks run (in this worktree, against `309c2a0..df54dec`):**
- `npm ci`: clean, 22 packages.
- `npm run check` (`tsc`): no errors.
- `npm test`: 957/957 pass, 0 fail — matches the worker's claim exactly.
- Line budgets independently recomputed with `wc -l`: develop `src/*.ts` = 584 lines total; core `src/*.ts` total 6097 minus `testing.ts`+`fake-agent.ts` (349, counted separately as `core/testing`) = 5748. Both match `test/structure.test.ts`'s `BUDGETS` and the ticket's accepted Decision (584 / 5748).
- Mutation 1 — removed the `ARTHUR_EVAL` refusal in `packages/core/src/cli.ts`: both `core/test/cli.test.ts` and `develop/test/eval.test.ts` failed, as claimed. Restored.
- Mutation 2 — disabled the stub's outside-repo refusal in `eval-stub.ts`: `eval.test.ts`'s home-sentinel test failed. Restored.
- Mutation 3 — stopped stripping `ARTHUR_` vars in `eval-run.ts`: same test failed, leaking `ARTHUR_ORCHESTRATION_FOLDER` into the agent's env. Restored.
- Mutation 4 — removed the timer's `kill()` call on timeout in `eval-run.ts`: the "hang" scenario's run never resolves (child process group never signalled); only an external 25 s shell timeout ended it — confirms the guard is load-bearing and the real code's process-group `SIGKILL` + `ESRCH` check (verified passing in the full suite) is what prevents an indefinite hang. Restored.
- Verified via `grep`: all host members the new code touches (`options`, `code`, `board`, `jobs.prompt`, `collect`, `collectEach`, `agent`, `folder`, `commands.register`) are pre-existing published members — consistent with the full suite's passing `plugin-api.test.ts` ("the host a plugin gets has exactly the members the page's host table lists") and the worker's claim that `docs/plugin-api.md` needed no change.
- Manually traced the stub's path-traversal guard (`path.resolve`/`path.relative` + `^\.\.(\/|$)` regex) against absolute paths, `../` sequences, and the repo-root itself — all caught; scenario `stub.files` keys come from the static, developer-authored `scenario.json`, not from agent-controlled call arguments, so no injection surface from the live agent.
- Diff scope matches the ticket's `Scope: In` list exactly (`packages/develop`, core's eval refusal only, docs, tests, `arthur.config.example.ts`, README, `arthur.mmd`, `test/structure.test.ts`); `findings.md` is the ticket's own folder.
- Commit: single Conventional Commit, scope `AR0276`, signed off.

PASS
