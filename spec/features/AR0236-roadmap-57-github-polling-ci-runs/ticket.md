# AR0236 - Roadmap 57: GitHub polling CI runs

```json
{
  "id": "AR0236",
  "title": "Roadmap 57: GitHub polling CI runs",
  "date": "2026-10-20"
}
```

## Description

This ticket builds roadmap entry 57 in `spec/roadmap.md`: the first piece of the `github` package, polling CI runs.

## Goal

The specification is roadmap entry 57: its Delivers and Done means.

- Kind: feature
- Budget: 8

## Done means

- Everything entry 57's Delivers and Done means list, each edge case with its test against a fake API in the shape of GitHub's REST documentation on an OS-chosen loopback port: the same run seen on two polls emits once (across a restart too); a rate-limit answer waits as GitHub says; a 401 is said once, not every poll; a branch deleted while in play.
- The new `github` package uses only the published host API of `docs/plugin-api.md`; if it needs a new host member, stop and say so in the final message instead of adding it.
- The token stays out of logs, events and the job's files.
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 57 as built.

## Scope

In:
- `packages/github` (new), its docs and tests, `arthur.config.example.ts`, README, `arthur.mmd`;
- `test/structure.test.ts` budgets for the new package.

Out:
- entry 58 (`arthur ci`, reruns, pushes, pull request reviews) and 59 (auto-merge).

## Decisions

- 2026-10-20: Started by the coordinator under the owner's free hand ("lec ze wszystkim śmiało", 99% usage until 08:00); 53 waits for 52 (AR0235), and 57 depends only on 41 and 51, both built.
