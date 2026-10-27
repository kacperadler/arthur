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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: docs

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F4 of AR0405
