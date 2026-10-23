# AR0310 - `arthur merge` fails for a user with no git identity, only after its review and checks ran

```json
{
  "id": "AR0310",
  "title": "`arthur merge` fails for a user with no git identity, only after its review and checks ran",
  "date": "2026-10-23"
}
```

## Description

`arthur merge` runs `git merge --no-ff -m …` in the project's checkout with whatever identity Git finds. A user whose git has no `user.name`/`user.email` (a fresh machine or container, as GitHub's ubuntu runner) gets `arthur merge: git merge arthur/<id> failed: fatal: unable to auto-detect email address (got '<user>@<host>.(none)'); main is unchanged`. Reproduced with `packages/delivery/test/auto-merge.test.ts` before AR0309's fix, under `HOME=<empty folder> GIT_CONFIG_NOSYSTEM=1`: 5 of 6 tests failed with that line. Nothing is lost (main is unchanged), but the refusal comes only at merge time, after a worker and a review were paid for, and its wording does not say what to set.

## Goal

A user whose git has no identity learns it before the first merge, from `arthur doctor` (or `arthur init`), with the fix named, instead of `arthur merge` failing after the review and checks ran. Arthur never invents an identity.

- Kind: bug

Evidence:
- `packages/delivery/src/merge-command.ts:85`
- Found by: 2026-10-23-ar0309-ci-git-identity-98a66810 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: check for an identity where Arthur first needs one (`arthur init` or the host's start, as a health line) and name the fix (`git config --global user.name/user.email`, or repo-local); keep Arthur from inventing an identity of its own.
- `npm test` and `npm run check` pass.

## Scope

In:
- check for an identity where Arthur first needs one (`arthur init` or the host's start, as a health line) and name the fix (`git config --global user.name/user.email`, or repo-local); keep Arthur from inventing an identity of its own.

## Decisions

- 2026-10-23: Source: F1 of AR0309
- 2026-10-23: Coordinator (free hand, finding ticket) approved.
