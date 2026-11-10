# AR0677 - A no to a plan or merge question still approves the ticket or the merge, and a bare yes without the decision id is enough

```json
{
  "id": "AR0677",
  "title": "A no to a plan or merge question still approves the ticket or the merge, and a bare yes without the decision id is enough",
  "date": "2026-11-10"
}
```

## Description

Since AR0665, setting a ticket `planned` and a plain `arthur merge` need a recorded owner decision. The gate checks only that the owner answered, not what he answered, and a plan or plain merge answer needs no decision id in his message. This ticket makes the gate pass only on an approval he gave for that decision.

## Goal

Two findings of AR0665, both deferred at its merge (`arthur findings AR0665`):

- F4 (review c77071b9): `packages/orchestration/src/decision-use.ts:30` (`refusal`) checks that the owner answered a `plan` question of the ticket in his own message, not what he decided. An answer "Not yet" still lets `arthur ticket status <id> planned --decision <id>` through; a merge decision answered "no" lets a merge through the same way (AR0664 F1).
- F5 (review ad549ef0): `packages/orchestration/src/decision-writes.ts:37`, `impact()` returns undefined for a `plan` decision and a plain merge decision (no `--what`), so either is recorded from any owner message that holds the words, without the id: a bare "yes" sent after the ask sets a ticket planned or merges a branch.

- Kind: security

## Done means

- A `plan` or `merge` decision lets `ticket status ... planned --decision` and `arthur merge --decision` through only when its answer picked the approval option asked with the question (`--picked` naming it); an answer with only `--decided`, or one that picked another option, is refused with a line naming the decision and what it picked. Tests in `packages/orchestration/test/` fail before and pass after, one per refusal.
- An answer to a `plan` or plain `merge` decision is recorded only from an owner message that names its id, as merge flags already are; a test records a bare "yes" and is refused.
- The coordinator role and `decision.md` say that plan and merge questions are asked with an approval option and answered with the id.

## Scope

In:
- `packages/orchestration/src/decision-use.ts`: the gate reads what was picked.
- `packages/orchestration/src/decision-writes.ts`: `impact()` covers `plan` and plain `merge`.
- `packages/orchestration/docs/commands/decision.md` and the coordinator role: the rule in words.
- Their tests in `packages/orchestration/test/`.

Out:
- Reading the owner's words for their meaning.
- Whether the `/silent --recommend` grant and classes leave plan questions to the owner (AR0665 F2): the owner's own decision.

## Decisions
- 2026-11-10: AR0677 approved; the owner: "AR-D604 - approve" (AR-D604)
