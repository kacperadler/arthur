# AR0511 - The github plugin's docs offer a classic token with `repo`, which writes every repository of the account

```json
{
  "id": "AR0511",
  "title": "The github plugin's docs offer a classic token with `repo`, which writes every repository of the account",
  "date": "2026-10-27"
}
```

## Description

F4 of AR0405 (spec/features/AR0405-security-review-of-our-own-code-part-4-other-machines-network-and-dependencies/findings.md).

- Kind: docs
- Severity: low
- Found by: 2026-10-27-worker-03ddbe1b (worker), 2026-10-27
- Where: `packages/github/docs/github.md:23`
- Input: the owner following the docs when he makes the token.
- Why the check misses it: the plugin needs only Actions: read (read and write for `arthur ci --rerun`) and Pull requests: read; the docs name the fine-grained token first but give "a classic one with `repo`" as equal, and the classic `repo` scope is full read and write of code, issues and settings on every repository the account reaches. Nothing in the plugin checks the token's scope.
- What: a token leaked from Arthur's process (AR0311's F17 kind of path, a coordinator transcript) pushes to any repository of the account, past `arthur merge`.
- Suggestion: drop the classic alternative from `github.md:23`, or name it as broader than needed and to be avoided; keep the fine-grained token's permissions as the only recipe, limited to the projects' repositories.

## Goal

The github plugin's docs recommend only a fine-grained token limited to the projects' repositories, so a leaked token cannot write every repository of the account. Evidence: F4 of AR0405 above: `packages/github/docs/github.md:23` gives "a classic one with `repo`" as an equal choice, and the classic `repo` scope writes code, issues and settings of every repository the account reaches, while the plugin needs only Actions (read, write for `arthur ci --rerun`) and Pull requests: read.

- Kind: docs

## Done means

- `github.md` names the fine-grained token as the one recipe: its repositories (the projects' only) and its permissions (Actions: read, or read and write for `--rerun`; Pull requests: read); the classic token is named as broader than needed and to be avoided.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/github/docs/github.md`: the token recipe.

Out:
- A check of the token's scope at start: not asked.

## Decisions

- 2026-10-27: Source: F4 of AR0405
- 2026-10-27: Merge AR0511 now; the owner: "AR-D202 1" (AR-D202)
