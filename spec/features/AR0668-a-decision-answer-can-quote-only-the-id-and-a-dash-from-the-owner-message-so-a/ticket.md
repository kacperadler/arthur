# AR0668 - A decision answer can quote only the id and a dash from the owner message, so a steered coordinator records his no as a yes

```json
{
  "id": "AR0668",
  "title": "A decision answer can quote only the id and a dash from the owner message, so a steered coordinator records his no as a yes",
  "date": "2026-11-09"
}
```

## Description

AR0664 makes `arthur decision answer` prove the owner's words come from his own channel message. The proof checks only that the given words appear somewhere in it, so a fragment of a "no" (the id, a dash, the word "no") passes as the proof of a recorded "yes". This ticket makes the proof hold the answer itself, and shows the owner his whole message beside what was recorded.

## Goal

Found by the AR0664 review-1 (2026-11-09, note "security" on `packages/orchestration/src/decision-proof.ts:31` at d72fa5ad): the words are not checked against `--decided` or `--picked`; a probe on the owner's message "AR-D12 no, do not merge — what is this?" returned proof for the words `AR-D12`, `—` and `no`, with the id required. A coordinator steered by outside text can then record a high-impact "yes" from his "no", and the notice shows only the quoted words, not his message. Same review, note "risk" at `decision-proof.ts:29`: `[file, <mime>] (<path>)` lines, whose path holds a sent file's name, count as his words.

- Kind: security

## Done means

- For a high-impact answer (the set AR0664 names: merge flags, `--budget 0`, `take-main`, approving a class), the words given must hold at least one word of letters or digits besides the decision id; words that are only the id, punctuation or a single character are refused, and the refusal says to quote his answer, not a fragment.
- The notice for a high-impact answer, built without the model, quotes the owner's whole message it was proved from (cut at 400 characters, the cut marked), beside `--decided`, so he sees a "no" recorded as a "yes".
- A `[file, <mime>] (<path>)` line of a message is not part of the text the words are matched in; a transcript of his voice note still is.
- Tests for each: the "AR-D12 no, do not merge" probe refused with only `AR-D12`, `—` or `no`; a full quote passes; the notice holds the whole message; a file name never proves words. Each fails before the change. `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Scope

In:
- `packages/orchestration/src/decision-proof.ts` (from AR0664): the word rule and the file-line exclusion.
- The notice for a high-impact answer, where AR0664 builds it: the whole message.
- `packages/orchestration/docs/commands/decision.md`: the rule.
- `packages/orchestration/test/decisions.test.ts`: the tests.

Out:
- Matching the meaning of his words to `--decided` (a yes against a no) with a model: not done, the notice is how he sees it.
- Ticket approval and plain merges needing proof: AR0665.

## Decisions
