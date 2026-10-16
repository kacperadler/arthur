# AR0039 - Review 1

- Job: 2026-10-16-review-ar0039-config-che-9f2bd670
- Branch: h/2026-10-16-ar0039-config-check-setu-badcdb9e
- Commit reviewed: 842d2a8faffb44de1d70192467f8f2f1bb97a138
- Verdict: PASS

## Final message

## Review: AR0039 — config check reports plugin setup refusals

### Correctness analysis of the dedup rule (the Focus)

Traced the determinism argument that makes this safe: `configCheck`'s own `before` flag (`refused.length>0 || check.problems.length>0 || missing`) exactly mirrors the preconditions under which the real binary's `loadPlugins` (`host.ts`) would itself fail *before* any `setup` runs — `checkPlugins` is called first, then `resolveEnv` (which throws on exactly `check.problems` ∪ missing variables, per `env.ts:resolveEnv`) before the `setup` loop. Since both the CLI's `load()` and `configCheck` call these same pure functions on the same config/shell within one process, `before === true` in `configCheck` can only happen when the real `load()` also failed at that same earlier stage — so `problem` in that case can never actually be a setup refusal, and the content is already printed via `refused`/`check.problems`/`missing` lines in different wording. No information is lost; nothing is a literal duplicate. When `before === false`, `setupProblem` (if defined) can only have come from the setup stage, so printing it is safe and necessary for `ok`.

Confirmed this holds for all four refusal kinds (load error, host refusal, env problem, missing variable), each with/without a concurrent setup failure, by code tracing and targeted mutation (below), including a case with a genuine setup failure *and* a warning present simultaneously (verified by hand — setup line correctly precedes the warning line, see Checks).

### Checks run (in this worktree)

- `npm ci`: clean, no output.
- `npm run check` (`tsc`): no errors.
- `npm test`: **118 tests, 118 pass, 0 fail.**
- `node --test packages/core/test/config-check.test.ts`: 7/7 pass.
- Manual reproduction of F1 (orchestration's `setup` registers `config`): `node cli.ts config check` → prints `plugin orchestration: setup failed: command config: registered by core and by orchestration; a command belongs to one plugin` then `no enabled plugin names an env variable`, exit 1. Matches worker's claim exactly.
- Manual case: setup failure + env-file warning (duplicate key) together → setup line printed, placed before the warning line, exit 1 — confirms warnings never gate the dedup rule and ordering matches the doc.
- Mutation 1 — drop `problem` passthrough in `cli.ts` (`configCheck("arthur.config.ts", process.env)`): new test fails (F1 case now wrongly reports exit 0). Matches worker's claim.
- Mutation 2 — remove the `before ||` guard from the `setup` line (`const setup = setupProblem === undefined ? [] : ...`): two tests fail with literal duplicated lines (`plugins: orchestration is required and missing...` printed twice; missing-variable message printed in both resolveEnv's and configCheck's own formatting). Matches worker's claim ("missing-variable lines get printed twice").
- Mutation 3 (not claimed by worker, I added it) — drop the `missing` disjunct from `before` (keep only `refused`/`check.problems`): caught by a pre-existing unit test (`ok` wrongly becomes `true` for a missing-variable config) and by the CLI binary test (duplicate missing-variable report). Confirms the `missing` term is load-bearing, not redundant.
- All mutations restored via `git checkout -- <file>`; `git status --short` clean before verdict.

### Scope / shape

- Diff confined to `cli.ts`, `config-check.ts`, `docs/commands/config.md`, their test — matches ticket's `Scope: In`.
- `load()` setup behavior unchanged (`Scope: Out` respected).
- No new file, no class/enum, no runtime dependency, no boundary crossed; structure tests (line budgets, import boundaries) already included in the 118 passing tests.
- Doc update accurately reflects new ordering/behavior (host refusal → setup refusal → warnings → problems → variable lines), verified against code and against the manual run.

### Notes (non-blocking)

- None beyond what's already covered; worker's final-message checks list, though initially said "lost," was fully reproducible and accurate when I ran it myself.

All Done-means points are met, the dedup rule is provably correct and survives targeted mutation (including one beyond what the worker tested), and both required commands pass.

PASS
