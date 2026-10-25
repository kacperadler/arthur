# AR0341 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The wake's redacted final message loses job ids, ticket folders and full commit hashes

- Kind: ux
- Found by: 2026-10-25-worker-da17ff9b (worker), 2026-10-25
- Where: `packages/orchestration/src/credential.ts:14`, `packages/orchestration/src/inbox.ts:132`
- What: `redact`'s rule for any run of 20 or more letters, digits, `_` and `-` that mixes letters and digits also takes a job id, a ticket folder's slug and a full commit hash. Now that the wake's final message goes through it, a worker's `Blocked: on 2026-10-23-ar0319-security-check-93862bb2` reaches the coordinator as `Blocked: on [redacted]`, and `spec/features/AR0341-a-blocked-job-s-question-goes/ticket.md` as `spec/features/[redacted]/ticket.md` (seen with `node -e` calling `redact` on those lines). The wake's first line keeps the job's reason unredacted, and `arthur jobs` keeps the record whole, so nothing is lost for good, but the coordinator reads less of the final message. The decision log had this already (decision.md says a full hash is redacted).
- Suggestion: spare the shapes Arthur writes itself before the 20-character rule: a job id (`YYYY-MM-DD-<kind>-<8 hex>`) and a ticket folder (`<PREFIX><digits>-<slug>`), in both copies of credential.ts (orchestration and session). Out: the vendor-key and bearer rules.
- Status: fixed in 495ef650 (the coordinator's AR-D31: the wake's final message loses the env file's values alone, by `redactValues`, and its `Blocked: user <question>` line every rule, as the question; a vendor-shaped key elsewhere in the final message now reaches the coordinator as written, as decided. The decision log keeps the shape rules.)

## F2. A plugin's wake line built from the final message is not redacted

- Kind: security
- Found by: 2026-10-25-worker-da17ff9b (worker), 2026-10-25
- Where: `packages/orchestration/src/inbox.ts:138`, `packages/projects/src/onboarding.ts:31`
- What: the wake redacts the job's question and the lines of its final message it shows, but hands each `coordinator.wake` provider the final message as the job wrote it (the providers parse it), and pushes their lines unredacted. projects' onboarding answers the questions it reads from the onboarding job's final message, so a credential in one reaches the coordinator's transcript through that line. Redacting every plugin line in the wake would also redact the job ids in their `arthur continue <id>` lines (F1).
- Suggestion: each provider that quotes the final message redacts what it quotes with `host.secrets` and its own copy of the rules; or, after F1, the wake redacts the plugins' lines too.
- Status: open
