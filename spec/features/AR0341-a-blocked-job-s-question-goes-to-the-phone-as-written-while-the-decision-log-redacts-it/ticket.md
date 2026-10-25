# AR0341 - A blocked job's question goes to the phone as written, while the decision log redacts it

```json
{
  "id": "AR0341",
  "title": "A blocked job's question goes to the phone as written, while the decision log redacts it",
  "date": "2026-10-23"
}
```

## Description

a credential on the owner's phone and in the coordinator's transcript, with the log alone clean.

## Goal

A blocked job's question is redacted before it reaches the phone, as the decision log already does; tested.

- Kind: security

Evidence:
- `packages/orchestration/src/blocked-notice.ts:40-51` (the `notice` text), `packages/orchestration/src/decision-hooks.ts:27` (the same question, redacted, for the log); the hand-over of a job's final message, `packages/orchestration/src/hand-over.ts`, the same way
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23

Also F1 of AR0340: `packages/orchestration/src/blocked-notice.ts:44` sends `<job> asks [<id>]: <question>` as the job wrote it, while the log holds it redacted; AR0340 added `host.secrets`, so the fix can use it.

## Done means

- The fix, with a test that proves it: pass the notice's text and the hand-over's message through `redact` (with F4's values); test in `packages/orchestration/test/job-states.test.ts` or a blocked-notice test: a job blocked on `user: the key is sk-live-4f9a8b7c6d5e4f3a2b1c?` emits a notice holding `[redacted]`. Out: redacting a job's log or result in its record (its own folder).
- `npm test` and `npm run check` pass.

## Scope

In:
- pass the notice's text and the hand-over's message through `redact` (with F4's values); test in `packages/orchestration/test/job-states.test.ts` or a blocked-notice test: a job blocked on `user: the key is sk-live-4f9a8b7c6d5e4f3a2b1c?` emits a notice holding `[redacted]`. Out: redacting a job's log or result in its record (its own folder).

## Decisions

- 2026-10-23: Source: F5 of AR0319
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
