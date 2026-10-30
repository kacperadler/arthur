# AR0577 - Defaults T9: the test kit keeps HOME, TMPDIR and the git identity in its own folder, and cleans up on a signal

```json
{
  "id": "AR0577",
  "title": "Defaults T9: the test kit keeps HOME, TMPDIR and the git identity in its own folder, and cleans up on a signal",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T9: P11. The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

`testing.ts` sets `HOME` and `TMPDIR` under its root, and `GIT_CONFIG_GLOBAL` to a kit file holding `user.name` and `user.email`; on SIGTERM, SIGINT and SIGHUP it runs its exit cleanup. The environment setup moves into a new `test-env.ts`, imported by `testing.ts`. The root stays in `tmpdir()` (the plan's Option 1).

- Kind: test

## Done means

- `testing.test.ts`: a SIGTERMed child leaves no root and no slice.
- Tests that read the real `HOME` or `TMPDIR` are fixed by naming their path, each named in the final message.
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (core/testing +6), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/testing.ts`, `packages/core/src/test-env.ts` (new), the tests that need a path named, `test/structure.test.ts`.

Out:
- Anything of another of the plan's tickets.
- Moving the kit's root out of `/tmp`.

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)
