# AR0095 - A project added to the config is unguarded until some `arthur` command loads it

```json
{
  "id": "AR0095",
  "title": "A project added to the config is unguarded until some `arthur` command loads it",
  "date": "2026-10-17"
}
```

## Description

`<home>/projects/checkouts` is rewritten when the config loads, which each `arthur` command does once at its start; the daemon `arthur run` loads it once and does not reload. Between a human saving `arthur.config.ts` with a new project and the next `arthur` command (`arthur projects`, a spawn, `arthur jobs`), a running job of another project may still write into the new project's checkout.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: security

Evidence:
- `packages/projects/src/projects.ts` (`keepCheckouts`, run in `setup`), `packages/core/src/cli.ts` (`loadConfig` once per command)
- Found by: 2026-10-17-ar0092-c3f72abb (worker), 2026-10-17

## Done means

- The fix, with a test that proves it: have `arthur run` reload the project list on each sweep (or when `arthur.config.ts` changes), or tell the human in `docs/commands/projects.md` to run `arthur projects` after adding one; the guard itself stays as it is.
- `npm test` and `npm run check` pass.

## Scope

In:
- have `arthur run` reload the project list on each sweep (or when `arthur.config.ts` changes), or tell the human in `docs/commands/projects.md` to run `arthur projects` after adding one; the guard itself stays as it is.

## Decisions

- 2026-10-17: Source: F1 of AR0092
