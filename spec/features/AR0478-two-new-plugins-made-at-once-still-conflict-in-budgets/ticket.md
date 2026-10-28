# AR0478 - Two new plugins made at once still conflict in BUDGETS

```json
{
  "id": "AR0478",
  "title": "Two new plugins made at once still conflict in BUDGETS",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0475 (spec/features/AR0475-line-budgets-on-one-line-plus-a-comment-log-conflict-on-most-merges-of-main/findings.md).

- Kind: chore
- Found by: 2026-10-27-worker-042433a0 (worker), 2026-10-27
- Where: `packages/develop/src/plugin-new.ts:98`
- What: `arthur plugin new` adds the new budget as the last one in `BUDGETS`, so two branches that each make a plugin insert at the same place, and Git conflicts there. Reproduce: copy `test/structure.test.ts` to `base`, make `ours` with `\tacme: 40,\n\n` and `theirs` with `\tzeta: 5,\n\n` after `\tfindings: 254,\n\n`, and run `git merge-file -p ours base theirs`: one conflict. Raises, the common case, merge cleanly (`git merge-file` on raises to `core`, `core/testing` and `findings`: 0 conflicts).
- Suggestion: insert the new budget in name order instead of last, so two new plugins with different names land at different places; the rest of the form stays. Worth it only if new plugins start landing in parallel; today one lands every few days.

## Goal

Two branches that each make a new plugin merge without a conflict in `BUDGETS`. Evidence: `packages/develop/src/plugin-new.ts:98` adds the new budget last, so both insert at the same place; `git merge-file` on two such copies of `test/structure.test.ts` gives one conflict (F1 of AR0475).

- Kind: chore

## Done means

- `arthur plugin new` inserts the new budget in name order; a test makes two plugins with different names from the same base and `git merge-file` merges them with no conflict.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/develop/src/plugin-new.ts`, `packages/develop/test/plugin-new.test.ts`.

Out:
- The form of `BUDGETS` and raises: unchanged.

## Decisions

- 2026-10-27: Source: F1 of AR0475
- 2026-10-28: Raise the develop plugin line budget from 706 to 710 for AR0478; the owner: "AR-D225 1" (AR-D225)
