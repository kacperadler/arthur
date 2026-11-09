# AR0664 - arthur decision answer needs the owner own channel message, and high-impact answers name the decision id

```json
{
  "id": "AR0664",
  "title": "arthur decision answer needs the owner own channel message, and high-impact answers name the decision id",
  "date": "2026-11-08"
}
```

## Description

Option A of the AR0482 plan: `arthur decision answer` records an answer only when one of the owner's own channel messages holds the words given, so text that steers the coordinator cannot answer for him.

## Goal

Close F1 of AR0403 as the approved AR0482 plan (spec/features/AR0482-the-coordinator-writes-the-owner-s-answer-itself-so-every-decision-gated-step-is/plan.md at 2f6f3959, option A) sets out: today `answer` in `packages/orchestration/src/decision-writes.ts:35-50` refuses only empty words and words starting "by policy", and `decision-use.ts:24-60` lets any other answer through for `merge --unreviewed|--no-ci`, `--budget 0` and `take-main`.

- Kind: security

## Done means

- `arthur decision answer` refuses unless a message of the turn in progress (`inbox/turn/`) or one in `inbox/answered/` after the ask holds the words given (case and spacing ignored); a `[forwarded from …]` message never counts; the refusal says to quote his words exactly.
- The answer record keeps `message: <seq>`, shown by `arthur decisions <id>`; `decision.owner` passes only an answer with this proof.
- For the high-impact set (merge flags, `--budget 0`, `take-main`, approving a class) the message must also name the decision id, and a notice built without the model tells the owner what was recorded.
- The `--recommend` grant is given only by the phone form `/silent on <work> --until … --recommend`; the shell `--recommend` refuses. Terminal text never counts as an answer (AR-D560).
- Tests for each refusal and pass, failing before the change; `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Scope

In:
- `packages/orchestration/src/decision-writes.ts`, `decision-log.ts`, `decision-use.ts`, `silent.ts`
- `packages/orchestration/docs/commands/decision.md`, the coordinator role, `roles/coordinator/plan-ended.md`
- `packages/orchestration/test/` (the existing `answer` calls get a test owner message)

Out:
- Owner checks for ticket approval and plain merges: AR0665.
- A sandbox for the coordinator (plan, Not available directly, option 2).

## Decisions

- 2026-11-09: Approve AR0664; the owner: "Approve AR0663 to AR0667" (AR-D577)
