# AR0221 - Findings

## F1. A restart between a claim's reply and the inbox queue sends the reply twice

- Kind: bug
- Found by: 2026-10-20-ar0221-roadmap-49-telegr-5cf10e3c (worker) and 2026-10-20-review-ar0221-roadmap-49-9d0ddc08 (review), 2026-10-20
- Where: `packages/orchestration/src/inbox.ts`, `turnText`
- What: a claim's `coordinator-replied` is emitted before the message is queued and removed from `inbox/received/`; a restart in that window resolves the message again at the next start and the owner gets the claim's reply (e.g. "heard: …") twice. [INFERENCE] from reading the code.
- Suggestion: record the resolved parts and sent replies before emitting, or emit after queueing.
- Status: ticket AR0223

## F2. The merge of main into the branch kept git's default subject

- Kind: cleanup
- Found by: 2026-10-20-review-ar0221-roadmap-49-ef1cede7 (review), 2026-10-20
- Where: commit 190f306
- What: `Merge remote-tracking branch 'origin/main' into …` instead of a ticket-scoped subject.
- Suggestion: none.
- Status: dropped (cosmetic, on a merged branch)

## F3. One mutation check was skipped by the worker

- Kind: risk
- Found by: 2026-10-20-ar0221-roadmap-49-telegr-5cf10e3c (worker), 2026-10-20
- Where: `packages/core/src/send-command.ts`
- What: whether the tests fail if a channel sends before every channel is checked.
- Suggestion: none.
- Status: dropped (review-1 ran the mutation; the existing CLI test fails)
