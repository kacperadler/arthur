# AR0698 - Release 0.1.0: tag v0.1.0 and its GitHub release by hand, once AR0641 merges

```json
{
  "id": "AR0698",
  "title": "Release 0.1.0: tag v0.1.0 and its GitHub release by hand, once AR0641 merges",
  "date": "2026-11-12"
}
```

## Description

Arthur's first release, v0.1.0, is made once by hand on GitHub, because the release workflow of AR0641 counts a release only when the root version changes, and main has been at 0.1.0 since AR0640. Every later release comes from the workflow.

## Goal

Roadmap 105 and 106 need a first release tag: installing (AR0642) checks out the newest `v*` tag, and there is none. The owner chose by hand for 0.1.0 (AR-D659). Evidence: `npm version 0.1.0 --no-git-tag-version` on a tree already at 0.1.0 prints `npm error Version not changed` (the AR0641 worker's final message).

- Kind: chore

## Done means

- `git ls-remote --tags origin v0.1.0` shows the tag at main's tip after AR0641's merge, and `gh release view v0.1.0` shows a release whose notes are `arthur changelog`'s entries up to that commit.
- The next version change on main makes its release through the workflow, with v0.1.0 as the one before it.

## Scope

In:
- No file: the coordinator runs `gh release create v0.1.0 --target <main's sha> --notes-file <changelog extract>` on the owner's word (AR-D659), once AR0641 has merged.

Out:
- The workflow itself (AR0641); installing and `arthur update` (AR0642).

## Decisions

<!-- - YYYY-MM-DD: one decision the human made, in one line. -->
