# AR0579 - Defaults T11: npm run mutate finds the tests that do not catch a change

```json
{
  "id": "AR0579",
  "title": "Defaults T11: npm run mutate finds the tests that do not catch a change",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T11: P15. The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

A new `test/mutate.ts` (at most 200 lines, no budget) and `"mutate": "node test/mutate.ts"` in `package.json`. Mutants: one hunk reverted to the base; one statement deleted; one `&&`/`||` operand dropped; `===`/`!==`, `<`/`<=`, `>`/`>=` flipped; a number +-1; `true`/`false`; `.some`/`.every`; one array element, regex alternative or class member dropped. Test files per mutant: the same-name test, then the tests that import the file, then the package's `test/`. It restores the bytes it keeps in memory on exit and on a signal, refuses a dirty tree, and stops at a `--max` cap. `checks-extension.ts` records `mutate pass|fail` and gives it the 1800 s timeout.

- Kind: test

## Done means

- `test/mutate.test.ts`: a surviving mutant named, a caught one not, the file restored after a signal, a dirty tree refused.
- Changed: `worker.md:20-21` become one line naming `npm run mutate`; `reviewer.md:18` becomes "start from mutate's survivors".
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (delivery +2), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `test/mutate.ts` (new), `test/mutate.test.ts` (new), `package.json`, `packages/delivery/src/checks-extension.ts`, `packages/core/roles/worker.md`, `packages/delivery/roles/reviewer.md`, `test/structure.test.ts`.

Out:
- Anything of another of the plan's tickets.
- Any dependency: the lockfile stays unchanged.

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)
- 2026-10-31: Merge AR0579 (npm run mutate) now; the owner: "Go all with recommendations" (AR-D407)
