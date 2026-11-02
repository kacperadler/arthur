# AR0390 - A job on another machine moves a Git LFS project's commits there and back without their LFS objects

```json
{
  "id": "AR0390",
  "title": "A job on another machine moves a Git LFS project's commits there and back without their LFS objects",
  "date": "2026-10-25"
}
```

## Description

[INFERENCE] from Git LFS's documented behavior; `git lfs` is not installed on this machine, so nothing was run. The base commit goes to the machine's bare repository by `git push` with no hook, so no LFS object goes with it, and the worktree there checks out pointers or tries the LFS endpoint the machine's remote URL implies. A branch made there comes back by `git fetch`, which brings pointers only; its large files stay in the machine's `.git/lfs`. `github.push` of that branch then runs `git lfs push origin`, which cannot find the objects locally and refuses, so the branch is not pushed (AR0379 makes that a refusal, not a push of pointers).

## Goal

A branch made by a job on another machine in a Git LFS project reaches origin with its LFS objects.

- Kind: fix

## Done means

- The fix, with a test that proves it: for a project whose `.gitattributes` names `filter=lfs`, run `git lfs push` to the machine's repository after the base push and `git lfs fetch` from it after the branch fetch, or refuse to place such a project on another machine and say so in `docs/deploy.md`. Out: pushes to origin (AR0379).
- `npm test` and `npm run check` pass.

## Scope

In:
- for a project whose `.gitattributes` names `filter=lfs`, run `git lfs push` to the machine's repository after the base push and `git lfs fetch` from it after the branch fetch, or refuse to place such a project on another machine and say so in `docs/deploy.md`. Out: pushes to origin (AR0379).

## Decisions

- 2026-10-25: Source: F1 of AR0379
- 2026-11-02: Approved: build AR0390 after AR0562, as part of Groups 1 and 2; report progress as tasks X/Y and new Z; the owner: "complete the AR0562, then go with Group 1 and Group 2, but mesure this changes i mean, whan you start, add to messages tasks: X/Y new: Z (tasks: X is completed / Y is todo; new: Z is how many new are created when you do the Y tasks)" (AR-D440)
