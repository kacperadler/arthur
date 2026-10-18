# AR0121 - Roadmap 27: job state in the coordinator and the channels

```json
{
  "id": "AR0121",
  "title": "Roadmap 27: job state in the coordinator and the channels",
  "date": "2026-10-18",
  "after": [
    "AR0120"
  ]
}
```

## Description

Roadmap entry 27 (`spec/roadmap.md`, "Job state in the coordinator and the channels"). The coordinator's context lists every unended job by state, and a job blocked on the owner sends one notice with its question.

## Goal

The owner hears at once when a job waits on him, and the coordinator sees which jobs are stuck (vision: work runs while the human is away).

- Kind: feature

## Done means

- Entry 27's Delivers and Done means, each edge case with its test against the fake host and the fake agent: a job blocked and continued before the next turn shows as working; one notice per block; a long question cut with the job id; quiet hours send the notice silently; no unended job means no section.
- Each option it adds is in `arthur.config.example.ts`; each command change has its doc page.
- `npm test` and `npm run check` pass.

## Scope

In:
- The orchestration plugin: the jobs section of the context, the wake message's state, the blocked notice, the footer counts.

Out:
- The channels themselves (telegram, entry 47).

## Decisions

- 2026-10-18: Proposed by the coordinator as the next orchestration entries toward the switch (owner: focus on Arthur, switch as soon as possible); waits for approval.
