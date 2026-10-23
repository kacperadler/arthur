# AR0110 - Roadmap 26: maxAgents and the models of each role

```json
{
  "id": "AR0110",
  "title": "Roadmap 26: maxAgents and the models of each role",
  "date": "2026-10-17",
  "after": [
    "AR0084"
  ]
}
```

## Description

Roadmap entry 26 (`spec/roadmap.md`, "`maxAgents` and the models of each role"). The owner sets how many agents run at once and which model each role uses; a spawn beyond the limit is refused with the running jobs named.

## Goal

The owner keeps cost and load in hand from one config: `maxAgents` across all projects, and a model and thinking level per role (vision: one human directs many agents).

- Kind: feat

## Done means

- Entry 26's Delivers and Done means, each edge case with its test against the fake host and the fake agent: a spawn refused when `maxAgents` jobs run, the message naming them; `maxAgents` of 1; a job ending frees its slot at once; an invalid thinking level refused before any job record exists; a role without a model uses the agent's default; `--model` on a spawn wins over the role's model.
- Each option it adds is in `arthur.config.example.ts`; each command change has its doc page.
- `npm test` and `npm run check` pass.

## Scope

In:
- The orchestration plugin (`beforeSpawn` for `maxAgents`), the `roles` option (model, thinking level, the quick model).

Out:
- Per-machine and per-feature caps (entries 30 to 34).

## Decisions

- 2026-10-17: The owner asked for six Arthur tickets done overnight, in order; the coordinator picked this entry as the sixth.
- 2026-10-17: Coordinator (owner delegated Arthur calls): orchestration line budget 658 -> 690 accepted; maxAgents defaults to 3; the quick model is `roles.quick: { model }`, passed as omp `--smol`.
