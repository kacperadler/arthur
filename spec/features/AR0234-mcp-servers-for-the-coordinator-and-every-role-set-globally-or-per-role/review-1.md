# AR0234 - Review 1

- Job: 2026-10-20-review-ar0234-mcp-per-ro-086dfce4
- Branch: h/2026-10-20-ar0234-mcp-per-role-223dbdae
- Commit reviewed: dacba9f8f5073f3e18df90bd3cc6a432c1ca188e
- Verdict: PASS

## Final message

Findings: none blocking.

Notes (non-blocking):
- `job-record.ts` (core) and `mcp.ts` (orchestration) duplicate the `.mcp.json`/`plugin.json`/`0600` write logic (~6 lines). Unavoidable: core cannot import a plugin, so the two write-sites can't share a helper. Not a cuttable duplication.
- The ticket's Decisions (as `main` holds it) already records "Coordinator accepted the orchestration budget raise of +111 ... core +14 (5698)", resolving the worker's open question in the final message; the branch's own commit adds a slightly different-worded Decisions line to the same effect. Consistent, not contradictory.

Checks run (in this worktree, on `1464fac8..dacba9f8`):
- `npm ci`: installs cleanly.
- `npm run check`: `tsc` passes, no output.
- `npm test`: 799/799 pass, 0 failed — matches worker's claim.
- Mutation tests (throwaway edits, each reverted and confirmed via `git status --short` clean afterward):
  - `job-record.ts`: `mcp.yml` overlay flipped to `xdev: true` → caught by `spawn-rules.test.ts` (exact file-content assertion).
  - `mcp.ts`: unknown-server-name check in `checkMcp` disabled → caught by `options.test.ts`.
  - `jobs.ts`: remote-machine guard removed (`preset.mcp` unconditionally passed to `writeRecord`) → caught by `machine.test.ts` (home-side record gained an `mcp/` folder it shouldn't have).
  - `spawn-rules.ts`: coordinator exclusion from `mcp` removed → caught by `spawn-rules.test.ts` ("the coordinator's servers are never in the answer").
  - `job-record.ts`: `.mcp.json` mode flipped `0o600` → `0o644` → caught by `spawn-rules.test.ts`.
- Verified `remote-job.ts`'s `writeRecord` call omits `mcp` (7 args, matches plan: "no MCP" on that path).
- Verified no-option regression coverage: `wrapper.test.ts` lines 107-110 and 139-143 (untouched, exact-argument asserts) still pass, proving no flag/file is added without the option.
- Verified boundary: `job-record.ts` (core) has no import of orchestration's `mcp.ts`; `mcp.ts` only imports `@arthur/core`.
- Confirmed CHANGELOG.md claim: its header does say "a hand edit is overwritten at the next merge" — correctly left untouched.
- All touched source files under their line budgets (wrapper.ts 196, jobs.ts 192, mcp.ts 99, coordinator.ts 131, orchestration.ts 140, orchestration-options.ts 139, spawn-rules.ts 34); package budgets in `structure.test.ts` raised and match the ticket's recorded decision; `the repository keeps every rule` test passes.
- Docs updated per plan: `docs/plugin-api.md` row, `roles.md`, `spawn.md`, `coordinator.md`'s new "MCP servers" section (both shapes shown), `arthur.config.example.ts`, roadmap entry 85 (Option A), ticket Decisions.

PASS
