# AR0664 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. **the proof checks that his words are there, not what they mean.** I ran a throwaway script on a turn message "AR-D12 no, do not merge" with the id required

- Kind: security
- Found by: 2026-11-09-review-1e00a9ff (review), 2026-11-09
- Where: `packages/orchestration/src/decision-proof.ts:9-10`
- What: `proof()` accepted the words `AR-D12`, `no`, `do` and `AR-D12 no`, each as message 5. So a steered coordinator can record any `--decided` for a high-impact question by quoting just the id. The plan's design allows this, and the notice is the only mitigation. The worker raised it; findings.md does not exist, so it is not filed yet.
- Status: deferred (client summary)

## F2. **text the owner did not write can count as his words.** The inbox text includes the file line `[<kind>, <mime>] (<path>)`, a path that holds the file's name, and the listen and video plugins' transcripts

- Kind: fix
- Found by: 2026-11-09-review-1e00a9ff (review), 2026-11-09
- Where: `packages/orchestration/src/decision-proof.ts:29`
- What: A file or recording someone else made, which he re-uploads without forwarding, can then supply "his" words. The worker raised it; findings.md does not exist, so it is not filed yet.
- Status: deferred (client summary)

## F3. **old class approvals still hold.** A class approved before AR0664, whose answer has no `message`, stays approved and keeps answering by policy

- Kind: fix
- Found by: 2026-11-09-review-1e00a9ff (review), 2026-11-09
- Where: `packages/orchestration/src/decision-classes.ts:60`
- What: Only `decision.owner` checks the proof, and the ticket does not ask for more.
- Status: deferred (client summary)
