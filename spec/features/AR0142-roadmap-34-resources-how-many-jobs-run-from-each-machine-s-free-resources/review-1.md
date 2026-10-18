# AR0142 - Review 1

- Job: 2026-10-18-review-ar0142-5bf2f605
- Branch: h/2026-10-18-ar0142-29f3b669
- Commit reviewed: 2d0d170d0ff28aceee9d5424a7297f132267f929
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

## Review summary

**Scope check:** Diff matches ticket AR0142 (roadmap entry 34) exactly: `keepFree` option, machine-free check with SSH cutoff, room calculation, spawn gate, placement wiring, context/CLI/`/resources` lines, docs, README/`arthur.mmd` status, `host.jobs.machines()` core addition, and AR0142 findings.md (F1, F2) matching the ticket's recorded Decision.

**Line-budget raises:** verified by direct `wc -l`: core `cat packages/core/src/*.ts | wc -l` = 5123 (4788 non-test + 335 for `testing.ts`/`fake-agent.ts`, counted separately per existing convention); resources = 401. Both match the structure-test budgets and the stated reasons (`host.jobs.machines()`, `jobs.ts` deduplicating the machine-name regex via `job-machine.ts`'s exported `NAME`; the new `machine-free.ts`/`room.ts`).

**Boundaries:** resources package imports only `@arthur/core`/`@arthur/core/plugin`; no plugin imports another plugin; `test/room-placement.test.ts` sits outside every package (correct carve-out for a cross-plugin test, matches existing project convention for this kind of test).

**Verification performed myself:**
- `npm ci`, `npm run check` (clean), `npm test` → 474/474 pass (matches worker's claim exactly).
- Mutation 1: removed `host.jobs.beforeSpawn(room.check)` → 2 room tests fail as expected (spawn no longer refused when no room).
- Mutation 2: off-by-one in the exact-fit floor division (`roomOf`'s `fits`) → caught immediately by the dedicated exact-boundary unit test and the context/CLI test.
- Restored both mutations; worktree clean (`git status --short` empty), `npm run check` clean afterward.
- Traced `host.jobs.run(..., 10)` → core's pre-existing `execute()` kills the child with `SIGKILL` past `limitSeconds` and resolves `code: null`; `machine-free.ts`'s `measure()` turns that into `check timed out after 10 s`, matching the doc and the ticket's Done-means wording.
- Confirmed `plugin.start()` (the 60 s timer) is only invoked by `arthur run`'s own loop (`core/src/run.ts`); for one-off commands (`arthur spawn`, `arthur resources`) the on-demand `fresh()` path (2-minute staleness) does the check instead — consistent with the worker's explanation and the smoke-test claim.
- Read `room.ts`/`machine-free.ts` fully: atomic write-then-rename for the per-machine JSON, notice-once-until-success logic, percentage-of-memory computed against the *checked* machine's own total (not the local host's) — all correct per the styleguide's "never see half a state" rule and the Done-means edge cases.
- Checked docs (`packages/resources/docs/resources.md`, `docs/commands/resources.md`, `arthur.config.example.ts`, `docs/deploy.md`, `README.md`, `arthur.mmd`, `packages/core/docs/commands/spawn.md`) against the implementation; all consistent.

**Notes (non-blocking):**
- `measure()`'s branches for ssh exit code `127` ("node is not on the PATH") and a generic nonzero exit are not individually unit-tested (only the 255/bad-JSON/timeout-adjacent paths are covered via `roomOf`/sample tests); each is a one-line message, low risk, not required by the ticket's named edge cases.
- `arthur.config.example.ts`'s `keepFree: { cpu: 1, memory: "2G", disk: "20G" }` literal would still be refused by `arthur config check` (disk unsupported until entry 69) if copy-pasted verbatim — but this exact inconsistency already existed before this branch (the whole `keepFree` key was previously unsupported too), and the branch's comment now explicitly documents it. Not a regression.

No finding here rises to a FAIL under the review guide: all Done-means edge cases are tested and the tests catch the mutations I tried; checks and claims reproduce exactly.

PASS
