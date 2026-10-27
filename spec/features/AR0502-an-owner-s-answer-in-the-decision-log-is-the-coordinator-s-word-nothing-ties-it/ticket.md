# AR0502 - An owner's answer in the decision log is the coordinator's word: nothing ties it to a message the owner sent

```json
{
  "id": "AR0502",
  "title": "An owner's answer in the decision log is the coordinator's word: nothing ties it to a message the owner sent",
  "date": "2026-10-27"
}
```

## Description

F4 of AR0404 (spec/features/AR0404-security-review-of-our-own-code-part-3-channels-merge-and-delivery/findings.md).

- Kind: security
- Severity: medium
- Found by: 2026-10-27-worker-d27fde45 (worker), 2026-10-27
- Where: `packages/orchestration/src/decision-log.ts:180-191` (`answer` takes `--decided` and the owner's "words" as free text), `packages/orchestration/src/decision-commands.ts:105-108`, `packages/orchestration/src/decision-use.ts:38-46` (`--unreviewed` and `--budget 0` accept any non-policy answer)
- Input: a coordinator turn steered by text that is not the owner's (a job's final message, a review, a CI log, a GitHub review, a forwarded text, F7), or a coordinator mistake, which runs `arthur decision ask` and `arthur decision answer … 'yes'`, then `arthur merge … --unreviewed --decision <id>`.
- Why the check misses it: the check proves an answer was recorded, not that the owner gave it. `arthur decision` is refused only inside a job, and the coordinator is outside every job. The message the owner sent (`message-received`, with its `seq` in the event log) is never named by the answer.
- What: AR0355's gate rests on the same thing as before it, the coordinator's judgement of whose word it read. One wrong turn merges unreviewed code or starts a job with no cost limit.
- Suggestion: `arthur decision answer` takes `--message <seq>`, and records it. It is refused unless the event log holds a `message-received` of that `seq` from a channel, sent after the ask, whose text names the decision id. `decision.owner` accepts only such an answer for `--unreviewed` and `--budget 0`. A test of each refusal. Out: answers to other kinds, and the terminal, where the owner types `arthur decision answer` himself, which needs its own mark (decide with the owner).

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F4 of AR0404
