# AR0090 - Name the machine in arthur jobs

```json
{
  "id": "AR0090",
  "title": "Name the machine in arthur jobs",
  "date": "2026-10-21"
}
```

## Description

`arthur jobs` names the machine each job runs on, so the owner sees where a job is without opening its record.

## Goal

The owner asks where a job runs (3 times last week).

- Kind: improvement

## Done means

- Each line of `arthur jobs` names its machine; `packages/core/test/job-records.test.ts` covers it.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/job-records.ts`: the column.

Out:
- Sorting by machine: AR0091.

## Decisions

- 2026-10-21: The owner approved it.
