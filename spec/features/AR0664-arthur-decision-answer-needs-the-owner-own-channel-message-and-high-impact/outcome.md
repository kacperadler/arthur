# AR0664 - Outcome

- Merged: 2026-11-09, `46ed9425`
- Branch: arthur/2026-11-09-worker-886b0650
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $11.00, reviews $3.32; review rounds 2

## What went in

- packages/orchestration/src/decision-proof.ts: new; finds the latest owner channel message (current turn, or answered after the ask; never a forward or a message without a channel) that holds the answer's words, not starting or ending inside a word, and the id when required; otherwise returns the reason it refuses.
- packages/orchestration/src/decision-writes.ts: `answer` requires that proof, records `message`, requires the id for a merge flag, take-main, any budget question or a class approval, and then emits a notice of what was recorded.
- packages/orchestration/src/decision-log.ts: the `Answer` type has `message?`; the log check refuses a `picked` or `message` that is not a whole number.
- packages/orchestration/src/decision-use.ts: `decision.owner` refuses a latest answer with no owner's message.
- packages/orchestration/src/decision-views.ts: `arthur decisions <id>` shows `(message <n>)`.
- packages/orchestration/src/silent.ts: shell `--recommend` refuses; `/silent on … --recommend` gives the grant; the notice of a recorded high-impact answer is never held.
- packages/orchestration/docs/commands/decision.md: documents the message proof, the id rule, the notice, the record's `message` field and the new refusals.
- packages/orchestration/docs/commands/silent.md: the grant is phone-only; shell refusal, phone refusals and usage; decision notices pass silent mode.
- packages/orchestration/roles/coordinator.md: quote the owner's own words exactly, ask him to answer high-impact questions with the id, and ask him to type the `/silent … --recommend` grant himself.
- packages/orchestration/roles/coordinator/plan-ended.md: step 4 quotes his words exactly from his own message.
- packages/delivery/docs/commands/take-main.md: the recipe says his words come from his own message naming the id.
- packages/models/docs/commands/usage.md: `models.usage` bounds the phone-only grant `/silent on … --usage <percent> --recommend`.
- packages/orchestration/test/owner-said.ts: new test helper that writes an owner message the way the inbox stores it.
- packages/orchestration/test/decisions.test.ts: tests for proof, refusal and pass (word-start and word-end checks included), the high-impact id rule and notice, class approval, regex characters, hand-edited fields and the real CLI; existing answer calls come with an owner message.
- packages/orchestration/test/decision-use.test.ts: `decision.owner` refuses answers without a message; existing answers come with an owner message.
- packages/orchestration/test/silent.test.ts: grant tests moved to `/silent`; shell `--recommend` refusal; decision notices not held.
- packages/orchestration/test/job-states.test.ts: its answer comes with an owner message.
- test/structure.test.ts: orchestration line budget 2764 → 2829 (AR-D538).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1604/1675 passed.

## Left open

- Deferred (client summary): F1. **the proof checks that his words are there, not what they mean.** I ran a throwaway script on a turn message "AR-D12 no, do not merge" with the id required
- Deferred (client summary): F2. **text the owner did not write can count as his words.** The inbox text includes the file line `[<kind>, <mime>] (<path>)`, a path that holds the file's name, and the listen and video plugins' transcripts
- Deferred (client summary): F3. **old class approvals still hold.** A class approved before AR0664, whose answer has no `message`, stays approved and keeps answering by policy
