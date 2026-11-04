# AR0619 - A branch delete on origin that fails for a network or GitHub error is retried, not left behind

```json
{
  "id": "AR0619",
  "title": "A branch delete on origin that fails for a network or GitHub error is retried, not left behind",
  "date": "2026-11-04"
}
```

## Description

When a merged job's branch cannot be deleted on origin because git could not reach it (SSH refused, a timeout, GitHub's 5xx), the github plugin gives up after one notice and the branch stays on origin until someone deletes it by hand. With this ticket it keeps the job's branch as pending and tries again on its next poll, telling the owner only when it finally succeeds after a failure or after it has given up for good.

## Goal

The owner, 2026-11-04: "github: arthur/2026-11-04-worker-e0340669 not deleted on origin: fatal: Could not read from remote repository. -> again, we have to fix that". During a GitHub incident (status page: Git Operations degraded, 2026-11-04 from about 11:30 Warsaw), every `jobs.keep` delete of a merged branch failed once and was never retried (`packages/github/docs/github.md`, "Branches on origin": a failure is one `notice` and the work ends); the coordinator deleted the branches of 2026-11-04-worker-7ccb98d9, -4746b4c2, -77196c79 and -e0340669 by hand with `gh api`. `arthur github branch sweep` cannot help while origin is unreachable, and needs a hand to run.

- Kind: fix

## Done means

- A delete that fails with git's own error (no connection, `Could not read from remote repository`, a `[remote rejected]` with a 5xx reason, a timeout) records the branch, its job id and the tip it would delete under the plugin's own folder (`.arthur/github/`), written to a temporary name and renamed.
- Each poll (`poll.everySeconds`) retries the recorded deletes first, with the same checks and lease as the first try (name, checkout, tip held by main or pushed by Arthur); a success removes the record and logs `github: deleted <branch> on origin (<commit>)`.
- A refusal that a retry cannot change (a tip not Arthur's, the branch checked out, the lease's stale info) is not retried: one notice, as today, and the record goes.
- The owner gets one notice for a branch: when it is first left (`... not deleted on origin, retrying: <why>`), and none for each retry; after 24 hours of failures, one last notice `github: <branch> still on origin after 24 h: <why>; arthur github branch sweep deletes it once origin answers`, and the record goes.
- Tests against the fake host and a local bare repository as origin, made unreachable and reachable again: the delete is retried and succeeds; a lease refusal is not retried; the 24-hour limit gives one notice; a second prune of the same job adds no second record. Each test fails when its behaviour is removed.
- `packages/github/docs/github.md` "Branches on origin" says so.

## Scope

In:
- `packages/github/src/` (the delete in `jobs.keep` and the poll).
- `packages/github/test/`.
- `packages/github/docs/github.md`.

Out:
- Pushes that fail (`github.push`): already retried by the coordinator's own push; a later ticket if needed.
- Switching git to HTTPS: not needed, the key works when GitHub does.

## Decisions
- 2026-11-04: AR0619 approved; the owner: "AR-D492 - approve" (AR-D492)
