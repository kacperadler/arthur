# AR0691 - An automatic restart kills a running merge of Arthur code, which is rolled back, so no code merge in Arthur can finish

```json
{
  "id": "AR0691",
  "title": "An automatic restart kills a running merge of Arthur code, which is rolled back, so no code merge in Arthur can finish",
  "date": "2026-11-11"
}
```

## Description

When `arthur merge` puts a merge commit that changes Arthur's code on main, a restart becomes due at once, and `arthur run` under its service makes it as soon as no job runs, while the merge's checks on main are still running. The restart ends the merge; the next `arthur run` rolls it back (AR0629), which moves HEAD back past the commit it noted, so a restart is due again. With no job running, no merge of Arthur's own code can ever finish.

## Goal

Seen on 2026-11-11: the AR0645 merge (`arthur merge 2026-11-09-worker-69fae305 --decision AR-D627`) put 2fc6f6b8 on main at about 08:01 and was cut by the restart; rerun, it put 4327201c on main at 08:05 and was cut again (the context said `arthur run started 2026-11-11 08:06 at 4327201`); both times main went back to the commit before the merge, with `.arthur/delivery/arthur/merge.lock` gone and AR0645 still `done`. Cause: `packages/session/src/restart.ts:127` holds a due restart only for `host.jobs.running()`; a merge is not a job, and nothing tells session that one runs (`packages/session/docs/session.md`, step 6: "once a restart is due, no job runs and no request is pending").

- Kind: fix

## Done means

- While a merge runs in any project (from its start to its end, `--auto` from delivery included), `arthur run` asks no due restart, and the fresh start's try and `/restart` treat it as they treat a running job; once it ends, the due restart goes on as today.
- A merge whose process is gone (killed) does not hold the restart forever.
- Tests that fail before the change and pass after it: a due restart is not asked while a merge runs, and is asked once it ends; a stale merge (process gone) does not hold it.
- `packages/session/docs/session.md` and the `/restart` doc say a running merge holds a restart.
- The project's checks pass.

## Scope

In:
- `packages/delivery/src/`: publish through the host whether a merge runs (its own `merge.lock` and the pid in it), as session may not read delivery's folder.
- `packages/session/src/restart.ts`: hold the due restart, the fresh start's try and `/restart` while a merge runs.
- Their tests and the two docs above.

Out:
- Making a merge survive a restart: the rollback of AR0629 stays.

## Decisions
- 2026-11-11: AR0691 approved: a running merge holds the restart; the owner: "AR-D639 - approve" (AR-D639)
