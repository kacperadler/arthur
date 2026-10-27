# AR0523 - umask.test.ts and spawn.test.ts put their test job in the production arthur-jobs slice

```json
{
  "id": "AR0523",
  "title": "umask.test.ts and spawn.test.ts put their test job in the production arthur-jobs slice",
  "date": "2026-10-27"
}
```

## Description

F4 of AR0517 (spec/features/AR0517-arthur-s-records-logs-sockets-and-locks-are-readable-only-by-arthur-s-own-user/findings.md). Two core tests start a job through the `arthur` CLI, whose job lands in the production systemd slice `arthur-jobs.slice`, beside the owner's real jobs.

## Goal

Every test that starts a job uses a slice of its own name, so a test run never shares a resource with production (styleguide: a test never uses a resource under a name production uses). Evidence: `packages/core/src/host.ts:51` hard-codes `SLICE`; `packages/core/test/umask.test.ts` and `packages/core/test/spawn.test.ts:224` run `arthur spawn` through the CLI (review 1 of AR0517).

- Kind: test

## Done means

- The two tests start their job in a slice named for the test run, and remove it at the end; no test names `arthur-jobs.slice`.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/host.ts`: the slice can be named for a test (an env variable the test kit sets, or the kit's own option).
- `packages/core/test/umask.test.ts`, `packages/core/test/spawn.test.ts`.

Out:
- The production slice's limits: unchanged.

## Decisions

- 2026-10-27: Source: F4 of AR0517
