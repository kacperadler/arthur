# AR0544 - The merge step timeout test fails under load: its 3 s limit also catches `npm run check`

```json
{
  "id": "AR0544",
  "title": "The merge step timeout test fails under load: its 3 s limit also catches `npm run check`",
  "date": "2026-10-28"
}
```

## Description

F3 of AR0456 (spec/features/AR0456-the-agent-s-own-npm-ci-cannot-write-npm/findings.md).

- Kind: test
- Found by: 2026-10-28-worker-0197a47f (worker), 2026-10-28
- Where: `packages/delivery/test/merge.test.ts:593-608`
- What: with load average about 40 on the host, `npm test` failed this one test: `actual: 'arthur merge: check failed on main (npm run check, npm test); ...'`, `expected: '... (npm test); ...'`; `npm run check` (`node -e ""` in a sandbox and scope) took over the 3 s `stepSeconds` the test sets for all steps. Run alone a minute later (load about 24) it passed in 6.9 s: `node --test --test-name-pattern="a step still running at merge.stepSeconds" packages/delivery/test/merge.test.ts`.
- Suggestion: give the test a limit the fast steps never reach under load, such as 15 s (the slow step's own timer, 60 s, stays above it); the test's run time grows by the same amount.

## Goal

The merge step timeout test passes under load. Evidence: with a load average of about 40, `packages/delivery/test/merge.test.ts:593-608` failed with `check failed on main (npm run check, npm test)` where it expects only `(npm test)`, because its 3 s `stepSeconds` also caught `npm run check`; run alone it passed (F3 of AR0456).

- Kind: test

## Done means

- The test's step limit leaves the fast steps room under load (about 15 s, below the slow step's 60 s), and the test still shows the slow step killed and named; it still fails when the kill is removed.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/test/merge.test.ts`.

Out:
- Other tests' timing under load.

## Decisions

- 2026-10-28: Source: F3 of AR0456
- 2026-10-28: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
