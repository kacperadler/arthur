# AR0142 - Roadmap 34: Resources: how many jobs run, from each machine's free resources

```json
{
  "id": "AR0142",
  "title": "Roadmap 34: Resources: how many jobs run, from each machine's free resources",
  "date": "2026-10-18",
  "after": [
    "AR0141"
  ]
}
```

## Description

Roadmap entry 34 (`spec/roadmap.md`), built as the entry says.

## Goal

Arthur starts only as many jobs as each machine's free CPU and memory allow.

- Kind: feature

## Done means

- Entry 34's Delivers, Also delivers and Done means, each edge case with its test against the fake host and the fake agent.
- Each option it adds is in `arthur.config.example.ts` and the option table; each command has its doc page; the README feature table and `arthur.mmd` show the entry built.
- `npm test` and `npm run check` pass.

## Scope

Out:
- Entries after 34.

## Decisions

- 2026-10-18: The owner: build the roadmap in its order; on 2026-10-18 evening he asked for a night plan for Arthur with Claude 7 Day usage up to 75%. This entry is in that plan.
- 2026-10-18: Coordinator (owner delegated Arthur calls): core +2 (host.jobs.machines) and resources 231 -> 401 (+170) accepted; resources checks each machine itself at start, every 60 s and on demand when 2 min old, instead of on every machine check (plugins may not import each other): accepted, F1 records it.
- 2026-10-18: Coordinator: CI `ci` failed on 8238c39 while the merge review ran npm test 504/504 green in its worktree; logs are unreadable here (no token). CI rerun by this commit.
