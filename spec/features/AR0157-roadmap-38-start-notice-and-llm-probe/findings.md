# AR0157 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. The inbox's notice after 3 unanswered turns repeats omp's error unredacted

- Kind: risk
- Found by: 2026-10-18-ar0157-0be32dff (worker), 2026-10-19
- Where: `packages/orchestration/src/inbox-extension.ts:118`
- What: after 3 coordinator turns in a row end without a reply, the inbox writes the notice `the coordinator's last 3 turns ended without a reply (<stopReason>: <errorMessage>); ...`, with the agent's `errorMessage` as omp gives it. A provider whose error echoes a key or token sends it to every channel. The session's `turn failed on <host>` notice (entry 38) redacts the same text (`packages/session/src/credential.ts`); this one does not.
- Suggestion: redact the error in orchestration the same way (a plugin cannot import session's file, so orchestration needs its own copy or the core publishes one), with a test of a key in the error. Leave the notice's wording as it is.
- Status: ticket AR0164

## F2. A provider outage sends a `turn failed` notice at every retry of the inbox

- Kind: improvement
- Found by: 2026-10-18-ar0157-0be32dff (worker), 2026-10-19
- Where: `packages/session/src/turn-extension.ts`, `packages/orchestration/src/inbox-extension.ts:117`
- What: entry 38 sends one `turn failed on <host>: <reason>` per coordinator turn that fails before any text. While a provider is down, the inbox hands the same messages over again after 10 s, then twice as long each time up to 5 min, and each of those turns fails, so the channels get about 8 notices in the first 20 minutes and one every 5 minutes after that, all with the same reason [INFERENCE: from the inbox's backoff, not run against a real outage].
- Suggestion: tell a reason once until a turn succeeds (or the reason changes), and say when it works again; decide whether that belongs to session or to the inbox's own notice after 3 unanswered turns.
- Status: ticket AR0165
