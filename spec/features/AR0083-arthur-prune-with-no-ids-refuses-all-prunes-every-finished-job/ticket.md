# AR0083 - arthur prune with no ids refuses; --all prunes every finished job

```json
{
  "id": "AR0083",
  "title": "arthur prune with no ids refuses; --all prunes every finished job",
  "date": "2026-10-16"
}
```

## Description

On 2026-10-16 the harness coordinator ran `h prune` with ids held in shell variables from an earlier call; they were empty, so the command became a prune of every finished job. `arthur prune` has the same shape (`packages/core/docs/commands/prune.md`: "Every job without ids"). An agent's empty argument must not widen what a destructive command touches.

## Goal

The coordinator role runs prune often; a lost id must fail loudly, not free every finished job (vision: plain files are the truth, nothing lost).

- Kind: fix
- Model: haiku

## Done means

- `arthur prune` with no ids prints the usage line and exits 2, removing nothing; a test with two finished jobs shows both kept.
- `arthur prune --all` frees every finished job as the bare command does today; a test.
- An empty-string id (`arthur prune ""`) is refused like an unknown id, before anything is removed; a test.
- Every command that removes or ends something (`prune`, `stop`, `steer`, `continue`, `ticket status`) refuses an empty-string id or text before acting, exit 2; one test per command.
- The roadmap's coordinator role (entry 23) carries one rule: ids in a destructive command are written out literally, never taken from a variable set in an earlier tool call.
- `prune.md`, `arthur prune --help` and any role or doc that runs a bare prune say `--all`.
- `npm test` and `npm run check` pass; core line budget held.

## Scope

In:
- `packages/core/src` prune command, its doc, tests, roles.

Out:
- What Git or `jobs.keep` keeps.

## Decisions

- 2026-10-16: The human asked how Arthur avoids the coordinator's empty-ids prune; coordinator: bare prune refuses, `--all` is explicit.
- 2026-10-16: The human asked again; coordinator: widened to every destructive command and to the coordinator role of entry 23.
