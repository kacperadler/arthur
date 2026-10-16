# AR0031 - Review 1

- Job: 2026-10-16-review-ar0031-config-che-509775bf
- Branch: h/2026-10-16-ar0031-config-check-host-63e14b42
- Commit reviewed: 2a67c7786220dbe56a385e3de90195c76b5f1eca
- Verdict: PASS

## Final message

Clean worktree, no leftover mutations.

---

**Findings:** none that block merge.

**Notes:**
- `host.ts:21-38` (`checkPlugins`) and `loadPlugins` share one code path (`loadPlugins` calls `checkPlugins` and consumes its result directly) — structurally impossible for the two to drift, stronger than a "test that both reject the same configs" would give.
- F1 in `findings.md` is an honest, reproduced gap (setup-stage refusals still show `ok`), explicitly out of the ticket's Done means ("without running any `setup`"), correctly left `Status: open` for the coordinator to turn into a ticket.

**Checks run (in this worktree, range `23cc57a..2a67c77`):**
- `npm ci`: clean install.
- `npm run check` (`tsc`): no errors.
- `npm test`: 117/117 pass, matches worker's claim.
- Mutation 1: removed the `checkPlugins`/`refused` block from `config-check.ts` → `config-check.test.ts` fails exactly as worker described (the "every refusal…" case and the "config does not load" exit-code case). Restored, re-ran, clean.
- Mutation 2: swapped `checkPlugins` for `loadPlugins` in `config-check.ts` (runs `setup`) → 4 failures reproduced (including a `setup`-ran leak changing output), matching worker's claim. Restored, re-ran, 117/117 pass.
- Manual smoke via `node cli.ts config check` in a scratch temp dir: `telegram`-only config → `orchestration is required and missing…`, exit 1; adding `orchestration` → `no enabled plugin names an env variable`, exit 0. Matches ticket's example and worker's claim.
- Manual repro of F1: `orchestration.setup` registering a command named `config` → `config check` prints ok, exit 0; `arthur help` shows `setup failed`. Confirms F1 is real and correctly scoped as a separate, open finding rather than silently dropped.
- Verified `cli.test.ts`'s "config does not load" case changed from asserting exit 0 (the bug) to exit 1 plus the refusal text — a strengthening of the assertion, not a loosening; `test/readme.test.ts` and `config-check.test.ts` fixture changes only add `orchestration`/`setup` to configs the host would otherwise refuse, matching the new, correct behavior.
- File sizes: `host.ts` 132 lines, `config-check.ts` 28 lines — within budget. No `package.json` changes, no new deps, no classes/enums, no plugin-boundary crossing (both touched files are core-internal).
- Doc (`packages/core/docs/commands/config.md`) accurately lists the host refusals now reported and the `setup`-shows-only-at-start caveat; matches implementation.

PASS
