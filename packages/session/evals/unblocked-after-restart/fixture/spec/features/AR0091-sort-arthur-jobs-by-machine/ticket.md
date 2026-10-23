# AR0091 - Sort arthur jobs by machine

```json
{
  "id": "AR0091",
  "title": "Sort arthur jobs by machine",
  "date": "2026-10-21"
}
```

## Description

`arthur jobs` groups each state's jobs by machine, so the jobs of one machine stand together.

## Goal

With 3 machines, the owner looks for a machine's jobs line by line.

- Kind: feat

## Done means

- Each state's jobs sorted by machine, then newest first; a test covers it.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/job-records.ts`: the sort. After AR0090.

Out:
- A filter by machine.

## Decisions

- 2026-10-21: The owner approved it.
