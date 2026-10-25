# AR0413 - The vision still says Arthur sends another machine no secret

```json
{
  "id": "AR0413",
  "title": "The vision still says Arthur sends another machine no secret",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0345 (spec/features/AR0345-two-docs-disagree-on-what-arthur-sends-another-machine/findings.md).

- Kind: docs
- Found by: 2026-10-25-worker-e48e0ded (worker), 2026-10-25
- Where: `spec/vision.md:134`
- What: "A machine needs Node, git, OMP logged in with its own credential, and the same version of Arthur's core; Arthur sends it no secret." A `prepare`'s variables, a provider's key of the models plugin among them, go to the machine on the launch's stdin (`packages/core/docs/commands/spawn.md`, "On another machine"), as `docs/deploy.md:9` now says. The vision is the owner's product text, so this worker left it.
- Suggestion: "Arthur sends it no MCP secret, only a `prepare`'s variables (a provider's key of the models plugin) on the launch's stdin", if the owner agrees.

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

- 2026-10-25: Source: F1 of AR0345
