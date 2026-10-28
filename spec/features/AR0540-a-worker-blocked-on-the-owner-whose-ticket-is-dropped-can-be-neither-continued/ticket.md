# AR0540 - A worker blocked on the owner whose ticket is dropped can be neither continued, stopped nor pruned

```json
{
  "id": "AR0540",
  "title": "A worker blocked on the owner whose ticket is dropped can be neither continued, stopped nor pruned",
  "date": "2026-10-28"
}
```

## Description

<!-- Two or three sentences: what changes, and for whom. -->

## Goal

A job blocked on the owner can always be ended, so its record and worktree do not stay for good once its question no longer applies. Evidence (2026-10-28): worker 2026-10-28-worker-9a40e7e7 asked whether AR0455 was already met by AR0454; the owner said yes and AR0455 was dropped. Then `arthur continue` refused ("AR0455 is dropped, which cannot move to in-progress"), `arthur stop` refused ("blocked (user: ...), not in a run; nothing to stop") and `arthur prune` kept it ("it is blocked ..., not ended"). The job holds no slot of `maxAgents`, but it stays in the coordinator's context under `blocked` with its worktree.

- Kind: fix

## Done means

- `arthur stop` on a job blocked on the user (not in a run) ends it (`ended`, reason `stopped`) and prints `<id>: stopped`; `arthur prune` then frees it. A test blocks a fake job on the user, stops it, prunes it, and fails without the change.
- The docs of `arthur stop` say so.
- `npm run check` and `npm test` pass.

## Scope

In:
- The core's stop command and its test; its doc page.

Out:
- A job blocked on a dependency or held by a plugin (stop already handles one held in a run).

## Decisions

<!-- - YYYY-MM-DD: one decision the human made, in one line. -->
