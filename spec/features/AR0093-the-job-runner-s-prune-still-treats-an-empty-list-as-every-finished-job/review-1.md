# AR0093 - Review 1

- Job: 2026-10-17-review-ar0093-494f7e41
- Branch: h/2026-10-17-ar0093-3007e5d9
- Commit reviewed: ad6d84dba5cd46bdd4bba19a8471288b45507328
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

**Findings:** none.

**Notes:**
- `job-records.ts`'s guard `ids.length === 0` relies on `"all".length` being nonzero (coincidental for a string literal type union); works correctly but is a slightly indirect way to special-case the sentinel. Not a correctness issue — verified `ids === "all"` is checked separately below.

**Checks run (in this worktree, range `7f16cb506b8…ad6d84dba5c`):**
- `npm ci`: clean, no output/errors.
- `npm run check`: exit 0, no type errors — matches claim.
- `npm test`: 340/340 pass — matches claim.
- Diff review: `job-records.ts` (`prune` now `readonly string[] | "all"`, throws on empty list), `job-commands.ts` (`--all` → `"all"`), `ticket-command.ts` (`rest.includes("")` → exit 2 before board read, replacing the old per-verb empty checks), `ticket.md` doc updated consistently to state the empty-word rule applies to every verb.
- Mutation 1: deleted the `ids.length === 0` throw in `job-records.ts::prune`. Ran `node --test packages/core/test/job-records.test.ts`: new test "the runner's prune refuses an empty list and an empty id…" failed (`Missing expected exception`) — mutation caught. Reverted via `git checkout -- packages/core/src/job-records.ts`.
- Mutation 2: deleted the `rest.includes("")` block in `ticket-command.ts`. Ran `node --test packages/core/test/cli.test.ts`: new/renamed test "arthur ticket with an empty word…" failed (`new ""` returned exit 1 with the title error, not exit 2) — mutation caught. Reverted via `git checkout -- packages/core/src/ticket-command.ts`.
- Grep for all `.prune(` call sites: confirmed every non-test caller passes real ids; the only caller that previously relied on `[]` meaning "all" was the one test migrated to `"all"`. No missed migration.
- Line budgets: `job-records.ts` 146, `ticket-command.ts` 40, `job-commands.ts` 80 — all well under the 200-line cap; structure tests in the full run also passed.
- `git status --short`: clean after reverting mutations.

All Done-means points (explicit `"all"` with migrated callers/tests, `ticket new ""`/`after "" <id>` refused exit 2, `npm test`/`npm run check` pass) are met; worker's final message claims match observed behavior exactly.

PASS
