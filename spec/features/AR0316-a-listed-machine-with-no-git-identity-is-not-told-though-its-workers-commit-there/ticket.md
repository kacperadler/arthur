# AR0316 - A listed machine with no git identity is not told, though its workers commit there

```json
{
  "id": "AR0316",
  "title": "A listed machine with no git identity is not told, though its workers commit there",
  "date": "2026-10-23"
}
```

## Description

AR0310 checks the identity of each project's checkout on the machine `arthur merge` runs on (`delivery <project> identity`). A worker on another machine (`arthur spawn --machine`) commits in a worktree there, with that machine's git config; the machines plugin's check runs `uname`, `arthur version`, `node`, `df` and `command -v`, never `git var GIT_AUTHOR_IDENT`/`GIT_COMMITTER_IDENT`, so a machine with no identity is reported online and its first worker's commit fails, or the worker makes up an identity with `git -c user.email=…` [INFERENCE: not run against a real remote machine].

## Goal

Each listed machine's check also says whether git there has an identity, so a worker placed on it does not fail at its first commit.

- Kind: risk

Evidence:
- `packages/machines/docs/commands/machines.md:43` (the check's script)
- Found by: 2026-10-23-ar0310-git-identity-chec-78843a24 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: add `git var GIT_AUTHOR_IDENT && git var GIT_COMMITTER_IDENT` to the one ssh command the check already runs, and name it in that machine's doctor line with the same fix wording as `delivery <project> identity`; placement stays by labels.
- `npm test` and `npm run check` pass.

## Scope

In:
- add `git var GIT_AUTHOR_IDENT && git var GIT_COMMITTER_IDENT` to the one ssh command the check already runs, and name it in that machine's doctor line with the same fix wording as `delivery <project> identity`; placement stays by labels.

## Decisions

- 2026-10-23: Source: F1 of AR0310
- 2026-10-23: Coordinator (free hand, finding ticket) approved.
