# AR0668 - Outcome

- Merged: 2026-11-10, `06f14a26`
- Branch: arthur/2026-11-09-worker-bb08f8e6
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md FAIL, review-4.md PASS, review-5.md FAIL, review-6.md FAIL, review-7.md PASS
- Cost: worker $10.87, reviews $7.91; review rounds 7

## What went in

- packages/orchestration/src/decision-proof.ts: refuses a high-impact answer when the quote, or his own text it matches, holds no word besides decision ids, or only one without the question's id. Matches the quote and the id only outside a file's line: only a voice or audio transcript that ends in its path counts, without the path. Returns the proving message's number and text.
- packages/orchestration/src/decision-writes.ts: records `message` from the proof. The high-impact notice adds the owner's whole message, redacted, cut after 400 code points with ` … (cut)`.
- packages/orchestration/docs/commands/decision.md: states the fragment rule (another decision's id, and the matched text, included), the file-line exclusion with a transcript's form, the new notice format (400 code points) and the new refusal.
- packages/orchestration/roles/coordinator.md: a high-impact answer quotes his answer, not only the id, a sign or one word. A file's name never counts. He sees his whole message.
- packages/delivery/docs/commands/take-main.md: the recipe's `<his words>` is his answer, never only the id, a sign or one word.
- packages/orchestration/test/decisions.test.ts: new tests:
- packages/orchestration/test/decision-use.test.ts: high-impact answers quote the id with the word.
- packages/orchestration/test/silent.test.ts: class approvals quote the id with the word.
- test/structure.test.ts: orchestration line budget 2829 → 2863, measured after merging main (AR-D538).
- spec/features/AR0668-a-decision-answer-can-quote-only-the-id-and-a-dash-from-the-owner-message-so-a/findings.md: F1, a transcript's path is recognised only when it starts with `/`. F2, a test run leaves a fake agent running. F3, a mime with a line break splits a file's line. F4, a word count is not meaning. F5, an audio file's transcript counts as his words.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1624/1695 passed.

## Left open

- Deferred (client summary): F1. A transcript line's path is told apart only by its leading slash
- Deferred (client summary): F2. A test run leaves a fake agent of a continued job running
- Deferred (client summary): F3. A part's mime holding a line break splits its file line
- Deferred (client summary): F4. Two of his words, or his id and one, still prove a "yes" from his "no"
- Deferred (client summary): F5. An audio file's transcript counts as his own words
