# AR0621 - Every git call of Arthur and every job reads past refs/replace, not only after a config check

```json
{
  "id": "AR0621",
  "title": "Every git call of Arthur and every job reads past refs/replace, not only after a config check",
  "date": "2026-11-04"
}
```

## Description

AR0615 sets `core.useReplaceRefs=false` again at each `checkConfig`, so a job that sets it back to true between two checks makes a reviewer's git (and any Arthur git call that does not pass `--no-replace-objects`) read a replaced object. This ticket makes the setting hold for every call, not only after a check.

## Goal

Close the race both AR0615 reviews named (review-1.md and review-2.md in AR0615's folder): `packages/core/src/git-config.ts:37` puts the setting back only when `checkConfig` runs, and it is not among the `pins` passed as `-c` to Arthur's git calls, unlike the keys AR0392 pinned. A job that writes `core.useReplaceRefs true` into the shared config, or into a reviewer worktree's `config.worktree` after that worktree is made, is read by the reviewer's own git commands until the next check. `arthur merge`, take-main, `gitOver` and manage's health checks already run git with `--no-replace-objects`.

- Kind: security

## Done means

- Every job's environment, reviewers' included, carries `GIT_NO_REPLACE_OBJECTS=1`; a test sets `core.useReplaceRefs true` and a replace ref in a job's repository after the spawn and shows the job's own `git log` reads the original object.
- `-c core.useReplaceRefs=false` is among the pins on every git call Arthur makes; a test sets the value to true between `checkConfig` and the call and shows the call reads past the replacement.
- Each of these tests fails when its line is removed; `npm run check && npm test` pass.

## Scope

In:
- `packages/core/src/git-config.ts`: `core.useReplaceRefs=false` in the pins.
- The core file that builds a job's environment: `GIT_NO_REPLACE_OBJECTS=1`.
- `packages/core/test/git-config.test.ts` and the job environment's test.
- `docs/deploy.md`: the security section names both.

Out:
- `.git/info/grafts`, which also changes what Git reads as a commit's parents: its own ticket if the owner wants it.
- Lock contention on `config.lock` while the value is not yet false (AR0615 review 1 note).

## Decisions

- 2026-11-04: AR0621 approved: run after AR0617, outside the 22-task counter; the owner: "AR-D494 - approve" (AR-D494)
- 2026-11-04: No client and no other project of the owner may be named in the repository: a ticket removes every such name from tracked files and adds a check that refuses any commit naming one; rewriting the published history is asked separately; the owner: "AR-D498 - THERE SHOULD BE SOME THING THAT WILL PREVENT THIS SIUTATIONS AND THERE CANNOT BE A CLIENT NAME IN THE REPO" (AR-D498)
