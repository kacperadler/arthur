# AR0533 - A merge decision lifts whichever flag the coordinator names, not the one the owner decided

```json
{
  "id": "AR0533",
  "title": "A merge decision lifts whichever flag the coordinator names, not the one the owner decided",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0503 (spec/features/AR0503-no-ci-is-a-bare-flag-on-the-owner-s-word-only-with-no-recorded-decision/findings.md).

- Kind: security
- Found by: 2026-10-27-worker-1a50f0e0 (worker), 2026-10-27
- Where: `packages/orchestration/src/decision-use.ts:27-56`; `packages/delivery/src/merge-command.ts:126`
- What: `decision.owner` checks a decision's kind (`merge`), ticket or job, state and use, never `what`: the question the owner answered is not tied to `--unreviewed` or `--no-ci`. So an answered `merge` decision of ticket X, asked to let X in without a PASS, also lets `--no-ci` through on the same merge (`arthur merge <job> --unreviewed --no-ci --decision <id>`: both flags ask, the second passes as the same use `merge <job>`), and an unused `merge` decision of X asked for anything else lifts either flag. Seen in the lines above; the delivery test `merge.test.ts` "a plain merge asks github.ci …" shows both flags passing on one id with its fake, which answers as orchestration does for an id.
- Suggestion: record the flag in the decision, `arthur decision ask --kind merge --for --unreviewed|--no-ci` (or the flags in the used mark: `merge <job> --unreviewed`), and refuse in `refusal` a decision whose recorded flag is not `what`. Out: `arthur take-main`'s own decisions, which already need no ticket and no job.

## Goal

A decision the owner gave for one flag of a merge never lets another flag through. Evidence: `packages/orchestration/src/decision-use.ts:27-56` (`decision.owner`) checks the decision's kind, ticket or job, state and use, but not `what`, so a decision answered for `--unreviewed` on `merge <job>` also passes `--no-ci` on that merge (F1 of AR0503, confirmed by its review). Also F2 of AR0503: no test shows `--no-ci --decision` still refuses a branch without a PASS (`packages/delivery/src/merge-command.ts:124`).

- Kind: security

## Done means

- A decision records which flag it allows (from its question or options, or a `--what` at ask time), and `decision.owner` refuses a `what` the decision does not name; a test: a decision for `--unreviewed` refuses `--no-ci`, and one for both allows both.
- A test: `arthur merge <job> --no-ci --decision <id>` on a branch with no PASS is refused; adding `&& mode.ci` to the PASS-gap condition fails it.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/orchestration/src/decision-use.ts`, `decision-log.ts` or `decision-commands.ts` (where `what` is recorded), their tests, `packages/orchestration/docs/commands/decision.md`.
- `packages/delivery/test/merge.test.ts`.

Out:
- Tying a decision to a message the owner sent: AR0502.

## Decisions

- 2026-10-27: Source: F1 of AR0503
