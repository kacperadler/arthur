# AR0399 - `git lfs push origin` reads origin's URL outside Git's transport policy

```json
{
  "id": "AR0399",
  "title": "`git lfs push origin` reads origin's URL outside Git's transport policy",
  "date": "2026-10-25"
}
```

## Description

`github.push` runs `git lfs push origin <ref>` before the push when the branch names `filter=lfs`. `GIT_PROTOCOL_FROM_USER=0` is set for it too, but git-lfs is its own program that resolves origin's URL to an LFS endpoint; whether it honours Git's `protocol.*.allow` policy, and whether some URL form makes it run another program, was not checked (git-lfs is not installed here) [INFERENCE].

## Goal

The LFS upload follows the same transport policy as the push, so origin's URL cannot route it through a helper or a folder.

- Kind: security

## Done means

- The fix, with a test that proves it: with git-lfs installed, try `git lfs push origin` against origin URLs `<name>::…`, `<name>://…`, `ext::…` and a folder with hooks, and refuse the LFS step for any transport the plain push would refuse.
- `npm test` and `npm run check` pass.

## Scope

In:
- with git-lfs installed, try `git lfs push origin` against origin URLs `<name>::…`, `<name>://…`, `ext::…` and a folder with hooks, and refuse the LFS step for any transport the plain push would refuse.

## Decisions

- 2026-10-25: Source: F2 of AR0393
