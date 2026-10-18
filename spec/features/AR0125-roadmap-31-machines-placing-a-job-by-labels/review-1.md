# AR0125 - Review 1

- Job: 2026-10-18-review-ar0125-machine-pl-f4ed15fa
- Branch: h/2026-10-18-ar0125-machine-placement-7dd32646
- Commit reviewed: dea4461a3ff59c25d5e361165b278ca2132ce8e1
- Verdict: PASS

## Final message

## Review: AR0125 — Machines: placing a job by labels

### Ticket & Focus verification

**Line budget (280→375):** `packages/machines/src/*.ts` totals 375 lines (`machine-check.ts` 70, `machine-options.ts` 84, `machine-place.ts` 106, `machines.ts` 115), matching `test/structure.test.ts`'s updated `BUDGETS.machines: 375` with a one-line comment citing AR0125. `jobs.ts` is exactly 200 lines as claimed. Reviewed every line of `machine-place.ts`, `job-machine.ts`, `jobs.ts`, `spawn-command.ts`: no dead code, no speculative abstraction, no scope beyond entry 31 (resources caps/34 untouched, just `host.collect("resources.free", name)` read defensively). The ticket's `ticket.md` (read `main:…/ticket.md`) already carries the coordinator's 2026-10-18 decision accepting 280→375 "if the review finds nothing to cut" — nothing found to cut, so the condition is satisfied.

**Ticket-path traversal (`need()` in `machine-place.ts`):** The `FEATURE` regex there is unanchored to a path boundary (`^(.*?spec\/features\/...)`), looser than the canonical `board-jobs.ts` `FEATURE`. But every `Ticket:` path reaching `need()` was already validated in `jobs.ts:158-159` via `fileAt(root, commit, path)` → `git cat-file -t <commit>:<path>`, **before** `machines.pick`/`jobs.place` is ever called. I verified directly that git rejects `..`-containing paths (`fatal: '...' is outside repository`, exit 128), so `fileAt` returns false and the spawn is refused with "no such file at HEAD" before placement runs. A crafted `Ticket: ../../../etc/spec/features/AR9999-x/ticket.md` cannot reach `need()`. Confirmed empirically with a throwaway git repo. No traversal bypass found.

**`--requires` parsing (`spawn-command.ts`):** Verified the regex/validation logic by hand and by mutation: duplicate `os=`/`arch=`, unknown keys, embedded spaces, trailing commas, and keyless tokens are all rejected via `text()` (missing/empty) or `requirement()` returning the raw string (triggering the usage error), always exit 2. Matches the 7 new parametrized cases in `spawn.test.ts`.

### Mutation testing (ran myself, restored after each)
- Removed the "no plugin places jobs by labels" refusal in `job-machine.ts` → caught (`spawn.test.ts` refusal case fails).
- Disabled `full()` (maxJobs gating) in `machine-place.ts` → caught (message/behavior mismatch in `machines.test.ts`).
- Disabled the `os` mismatch check in `lacks()` → caught (`machines.test.ts` refusal message changes).
- Loosened the `--requires` key regex to accept any lowercase key → caught (`spawn.test.ts` usage-error case fails).
All four independent mutations across core and the plugin were caught by existing tests, corroborating the worker's mutation-testing claim.

### Checks run (reproduced myself in this worktree)
- `npm ci` — ok.
- `npm run check` — `tsc`, clean, no output.
- `npm test` — 411/411 pass, 0 fail (matches claim).
- `git status --short` after all mutation reverts — clean.

### Scope / boundaries
- `machine-place.ts` only imports `@arthur/core`, `@arthur/core/plugin`, and sibling files in its own package — no cross-plugin import; core imports no plugin (both covered by passing structure tests).
- `requires`/`Labels` types are duplicated (core `Requires` vs. machines `Labels`) rather than shared — required by the plugin-boundary rule since `job-machine.ts` isn't a published `@arthur/core` export; not avoidable duplication.
- `arthur.config.example.ts` already documented `requires` (pre-existing); correctly untouched. No option table exists yet (entry 93); correctly not created.
- Docs (`spawn.md`, `machines.md` "Placing a job", `projects.md`, `deploy.md`, `coordinator.md`, README, `arthur.mmd`) all accurately reflect the implementation; README/mermaid consistency enforced and passing via `test/structure.test.ts`.
- `findings.md` F1/F2 are reasonable, correctly scoped as out-of-entry risks for future entries (28/52, 34), not blockers here.
- Commits are two well-formed Conventional Commits scoped `AR0125`.

### Notes (non-blocking)
- `machine-place.ts`'s local `FEATURE` regex is looser than `board-jobs.ts`'s canonical one (matches "myspec/features/..." as if it were "spec/features/..."); harmless in practice since the matched path must already exist as a real tracked file (no traversal), but worth tightening for clarity next time it's touched.
- Reading `ticket.md` from the project's main-checkout working tree (not the spawn's HEAD blob) means an uncommitted edit to `ticket.md` after HEAD is read instead of the committed version; this is an explicit, flagged worker decision, accepted in the ticket's Decisions section.

No finding meets a FAIL criterion: all Done-means edge cases are implemented and tested, checks reproduce exactly as claimed, boundaries hold, no scope creep, budget raise is justified and nothing found to cut.

PASS
