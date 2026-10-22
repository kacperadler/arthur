# AR0285 - A job's question answered by policy still reaches the owner as a question

```json
{
  "id": "AR0285",
  "title": "A job's question answered by policy still reaches the owner as a question",
  "date": "2026-10-22"
}
```

## Description

when an approved class of kind `job` answers a blocked job's question by policy, the notice every channel sends still reads `<job> asks [AR-D3]: <question>` (asserted as it is in `packages/orchestration/test/decisions.test.ts`, "a job's question an approved class matches is answered by policy..."), so the owner's phone shows a question nobody waits on him for; only the coordinator's wake and its reply say it was decided by policy.

## Goal

When a class answers a job's question by policy, the owner's phone says it was decided by policy instead of showing it as a question waiting for him.

- Kind: improvement

Evidence:
- `packages/orchestration/src/blocked-notice.ts` (the notice text), `packages/orchestration/src/decision-hooks.ts` (`askOfJob` returns only the id)
- Found by: 2026-10-22-ar0284-decision-classes-3454afe5 (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: let `askOfJob` return the policy answer too, and have the notice end `— answered by policy (<class id>): <decided>`; the notice's cut at one message's length and its one-per-block mark stay as they are.
- `npm test` and `npm run check` pass.

## Scope

In:
- let `askOfJob` return the policy answer too, and have the notice end `— answered by policy (<class id>): <decided>`; the notice's cut at one message's length and its one-per-block mark stay as they are.

## Decisions

- 2026-10-22: Source: F1 of AR0284
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
