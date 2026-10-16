# AR0001 - Review 1

- Job: 2026-10-16-review-ar0001-arthur-boo-b351bb13
- Branch: h/2026-10-16-ar0001-arthur-bootstrap-2d0a16df
- Commit reviewed: 119f1bf1e154331ab48e13116ca82f9627b136a4
- Verdict: PASS

## Final message

Findings: none that block merge.

Notes:
- `spec/roadmap.md`'s core order (event stream, entry 5, before job runner/board, entries 9/16-17) diverges from the ticket's literal parenthetical sequence ("job runner, board, event stream, guards"). The reordering is technically necessary (job runner and board emit events from their first line, entries 9/16 both depend on 5) and is disclosed explicitly in the final message as one of the four flagged design choices — not a silent departure, and no `## Decisions` bullet is contradicted.
- `docs/architecture/core-and-plugins.mmd` groups `orchestration`, `session`, `schedule` under a subgraph labelled "Coordinator - always on", but only `orchestration` is required/always-on per the vision and example config (`session` has no `required` tag). Cosmetic only.

Checks run:
- `npm ci && npm run check && npm test` from the reviewed worktree: `tsc` 0 errors, `node --test` 1/1 pass.
- Mutation: changed `sum(2, 3)` to `sum(2, "3")` in `packages/core/test/runner.test.ts` → `tsc` fails with TS2345, test fails (`'23' !== 5`); reverted, `git status` clean.
- Diffed `LICENSE` against the canonical FSL-1.1-ALv2 template: identical except `Copyright 2026 Kacper Adler` filled in correctly.
- Parsed `.github/workflows/ci.yml` with `js-yaml`: triggers `push`/`pull_request`, `ubuntu-latest`, Node 24, step `npm ci && npm run check && npm test`.
- Rendered all three `docs/architecture/*.mmd` files with `@mermaid-js/mermaid-cli` (`--no-sandbox`): all three produce valid SVGs, confirming they parse as Mermaid.
- Diffed inventory ids (`git show <base>:spec/draft/inventory.md`) against `spec/roadmap.md`'s coverage-table ids: exact match, 115/115, no extras.
- Counted roadmap's Commands/Settings table rows: 26 commands, 14 settings — matches worker's claim.
- Parsed all 63 roadmap entries programmatically: numbered 1–63 with no gaps; every `Depends on` references only a strictly earlier entry (no forward/self dependency); every `Size` is within half-day-to-a-day.
- Confirmed `spec/draft/` fully removed (`ls` fails, `git show --stat` of both docs commits shows its files deleted).
- `node --check arthur.config.example.ts` succeeds (syntax only, matching the claim that `tsc`'s `include` excludes it).
- Grepped new docs for old ticket ids (`K0\d{3}`), old absolute paths, `H_` env vars: none found.

Design-move judgment (per Focus):
1. Test kit → `@arthur/core/testing`: consistent across vision, roadmap (entry 4), example config comment; no ticket Decision contradicted.
2. Coordinator tmux/`arthur attach`/`exitWaitSeconds`/`restartDelaySeconds` → `orchestration`, not `session`: matches vision Decision 9/14 and example config; required since `orchestration` must be always-on and `session` is optional.
3. Event stream earlier in core order: justified and disclosed (see Notes).
4. Example config untyped: consistent with `tsconfig.json`'s `include` (no `@arthur/*` packages exist yet); only `node --check` run, as claimed.

PASS
