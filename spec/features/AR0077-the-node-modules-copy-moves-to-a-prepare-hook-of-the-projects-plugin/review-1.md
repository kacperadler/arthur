# AR0077 - Review 1

- Job: 2026-10-16-review-ar0077-ar0077-the-1f6c9fbd
- Branch: h/2026-10-16-ar0077-ar0077-the-node-m-d8a03f3a
- Commit reviewed: 3eb5cce126e2bdcd800ea73bbdc149a18e943988
- Verdict: PASS

## Final message

## Review: AR0077 — node_modules copy moves out of core

### Findings
None. Diff matches B1 exactly and tracks the ticket's explicit Decisions.

### Notes (non-blocking)
- All five touched files (`spawn.md`, `jobs.ts`, `node-modules.ts`, `jobs.test.ts`, `spec/roadmap.md`) are either named by proposal B1 or covered by the ticket's 2026-10-16 coordinator Decision (test deletion, roadmap row R2, "no copy until entry 41" reading). No scope creep.
- `jobs.ts` drops from the 200-line cap to 190 lines as a side effect — welcome, not required by the ticket.
- Core budget (`BUDGETS.core = 4372` in root `test/structure.test.ts`) correctly left untouched; the plan places that rewrite in a separate ticket (#8).

### Checks run (in this worktree, on commit `3eb5cce`)
- `npm ci` — 5 packages added, clean.
- `npm run check` (`tsc`) — no output, passes.
- `npm test` — 271 tests, 271 pass, 0 fail. Matches worker's claim.
- `node packages/core/src/cli.ts spawn --help` — line 15 reads exactly as the worker's final message quotes: "No `node_modules`: the core copies none. A plugin's `prepare` step can place one (roadmap entry 41 gives the `projects` plugin the copy); otherwise the job installs from the lockfile itself, as the worker's role tells it."
- `wc -l packages/core/src/jobs.ts` → 190 (under the 200-line cap, no dead import of `node-modules.ts`).
- `grep` for `node-modules|copyNodeModules` across `packages/core` → no matches; no dead reference left.
- Core line count via `lineCount`-equivalent `node -e` script over `packages/core/src`: **4322** — matches the worker's claimed before/after (4339 → 4322, a 17-line drop), and matches `git diff --numstat`/`--shortstat` exactly (5 files, 8 insertions, 43 deletions).
- Throwaway smoke test (written into `packages/core/test/`, run with `node --test`, then deleted, confirmed via `git status --short` clean): spawned a job against a repo with a matching `package-lock.json` and a populated `node_modules/left-pad`; asserted `existsSync(join(job.worktree, "node_modules")) === false`. Passed — confirms the copy behavior is genuinely gone, not just the test.
- Read `packages/core/roles/worker.md:16` — already instructs "Install dependencies from the lockfile before the first check when the worktree has none (for example `npm ci`)," satisfying the ticket's "no spawn loses it silently" requirement without new code.
- Cross-checked `spawn.md`, roadmap entries 9/21/41 and row R2 against each other and against the deleted `copyNodeModules` semantics (copy-on-write, links kept, refusal on differing/missing lockfile or absent `node_modules`) — all consistent; entry 41's new edge cases mirror the deleted function's refusal conditions exactly.
- Commit message: `refactor(AR0077): move the node_modules copy out of the core to entry 41` — Conventional Commits, ticket-id scope, single commit as described.

No mutation test applies: this ticket removes a behavior rather than adding a guarded one, and the removal is covered end-to-end by the smoke test above (behavior re-enabled would fail that assertion). All Decisions in the ticket are honored verbatim; nothing is stubbed or only claimed.

PASS
