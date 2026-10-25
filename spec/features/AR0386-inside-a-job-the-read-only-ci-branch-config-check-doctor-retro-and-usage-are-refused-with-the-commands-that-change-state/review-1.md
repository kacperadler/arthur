# AR0386 - Review 1

- Job: 2026-10-25-review-ar0386-read-only-db4dadcc
- Branch: h/2026-10-25-ar0386-read-only-cmds-in-1746d887
- Commit reviewed: e978f7ad11de4eb56b6b094ffcdf798aafaaacea
- Verdict: PASS

## Final message

Clean.

---

**Review summary**

Branch implements AR0386's Done means exactly: `arthur ci` gets `inJob: true`; `--rerun` refuses itself inside a job (after usage check, before any GitHub call), matching the `schedule add`/`remote-job`/`cli.ts` refusal convention (same `refused inside a job <id>: …` message, `basename(job)` for the id). `config check`, `doctor`, `retro`, `usage` correctly stay refused per the ticket's explicit "others stay refused until a role names a need," and the worker's final message documents that search. Ticket's Decisions section got the 2026-10-25 entry recording the budget raise and the per-command choice, as the instruction required.

Checks run (in this worktree, not the main checkout):
- `npm ci` — clean.
- `npm run check` — exits 0, no tsc errors.
- `npm test` (full suite, 209s) — `tests 1097, pass 1097, fail 0`. Matches worker's claim exactly.
- Line budget: `find packages/github/src -name '*.ts' | xargs wc -l` → 658, matches the raised budget and the ticket's recorded reason; `git diff --numstat` on `github-ci.ts` confirms +5/−1 as the comment states.
- Mutation testing (applied via `sed`, restored via `git checkout --`, `git status --short` clean afterward):
  - Removed `inJob: true` → both `test/job-gate.test.ts` tests fail (confirmed: 2/2 not ok).
  - Disabled the `--rerun` refusal (`if (false) return …`) → `packages/github/test/github.test.ts`'s refusal test fails, and `test/job-gate.test.ts`'s "every command … refuses" test fails (confirmed both).
- Spot-checked `withEnv` teardown (`t.after`) in `github.test.ts`: `ARTHUR_JOB` is restored after the test, no leakage into later tests despite the manual `process.env.ARTHUR_JOB = ""` mid-test.
- `basename(job)` pattern matches the existing convention used in `cli.ts`, `remote-job.ts`, `schedule-command.ts` — no new convention introduced.
- Commits are two, Conventional Commits, scoped `(AR0386)`.

No boundary, shape, or scope violations: change stays inside `packages/github`, `packages/core/docs`, the ticket, and the two test files the ticket's scenario touches. No new runtime dependency, no new file, no class/enum, file still under budget.

Notes (non-blocking): none beyond what's already in the worker's final message about the known AR0354 limit (clearing `ARTHUR_JOB` bypasses the gate) — correctly out of scope here and already tracked.

PASS
