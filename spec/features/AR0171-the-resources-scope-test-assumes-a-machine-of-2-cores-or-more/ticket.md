# AR0171 - The resources scope test assumes a machine of 2 cores or more

```json
{
  "id": "AR0171",
  "title": "The resources scope test assumes a machine of 2 cores or more",
  "date": "2026-10-19"
}
```

## Description

"a job spawned with the plugin gets its caps on its own scope" sets `perJob.cpu` 1.5 and expects `CPUQuotaPerSecUSec` `1.500000s`; the core caps a job's CPU at the machine's cores, so on one core (`taskset -c 0 node --import @arthur/core/testing --test packages/resources/test/resources.test.ts`, with a systemd user manager) it gets `1s` and fails every time (12 of 12 runs). Not a flake: GitHub's runner has more cores.

## Goal

The resources scope test passes on a machine of any core count, so a 1-core runner never fails it.

- Kind: bug

Evidence:
- `packages/resources/test/resources.test.ts:75`
- Found by: 2026-10-19-ar0167-be6531bc (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: take the expected quota as `min(1.5, availableParallelism())`, or skip below 2 cores; nothing else changes.
- `npm test` and `npm run check` pass.

## Scope

In:
- take the expected quota as `min(1.5, availableParallelism())`, or skip below 2 cores; nothing else changes.

## Decisions

- 2026-10-19: Source: F1 of AR0167
- 2026-10-19: The owner approved this. The coordinator builds it alongside the roadmap entry that touches the same files.
