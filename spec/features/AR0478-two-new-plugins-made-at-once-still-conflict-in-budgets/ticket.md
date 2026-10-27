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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: chore

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F1 of AR0475
